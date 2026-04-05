#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <exception>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include <sqlite3.h>

#include "Solver.hpp"

using namespace GameSolver::Connect4;

namespace {

struct Options {
  std::string databasePath = "data/connect4_cache.sqlite3";
  int batchSize = 0;
  double heartbeatSeconds = 5.0;
  int maxDepth = 8;
  bool solveRoot = false;
  std::optional<std::string> openingBookPath;
  std::optional<std::string> solveSequence;
};

struct SolveRecord {
  std::string sequence;
  int depth = 0;
  std::string bestMoves;
  std::vector<int> scores;
  int positionScore = 0;
  unsigned long long nodeCount = 0;
  double elapsedMs = 0.0;
};

class Statement {
 public:
  Statement(sqlite3* database, const char* sql) : database_(database) {
    const int rc = sqlite3_prepare_v2(database_, sql, -1, &statement_, nullptr);
    if (rc != SQLITE_OK) {
      throw std::runtime_error("sqlite prepare failed: " + std::string(sqlite3_errmsg(database_)));
    }
  }

  ~Statement() {
    if (statement_ != nullptr) {
      sqlite3_finalize(statement_);
    }
  }

  sqlite3_stmt* get() const {
    return statement_;
  }

  void bindInt(int index, int value) {
    check(sqlite3_bind_int(statement_, index, value), "bind int");
  }

  void bindInt64(int index, sqlite3_int64 value) {
    check(sqlite3_bind_int64(statement_, index, value), "bind int64");
  }

  void bindDouble(int index, double value) {
    check(sqlite3_bind_double(statement_, index, value), "bind double");
  }

  void bindText(int index, const std::string& value) {
    check(sqlite3_bind_text(statement_, index, value.c_str(), -1, SQLITE_TRANSIENT), "bind text");
  }

  bool stepRow() {
    const int rc = sqlite3_step(statement_);
    if (rc == SQLITE_ROW) {
      return true;
    }
    if (rc == SQLITE_DONE) {
      return false;
    }
    throw std::runtime_error("sqlite step failed: " + std::string(sqlite3_errmsg(database_)));
  }

  void stepDone() {
    const int rc = sqlite3_step(statement_);
    if (rc != SQLITE_DONE) {
      throw std::runtime_error("sqlite step failed: " + std::string(sqlite3_errmsg(database_)));
    }
  }

 private:
  void check(int rc, const char* context) {
    if (rc != SQLITE_OK) {
      throw std::runtime_error(std::string("sqlite ") + context + " failed: " + sqlite3_errmsg(database_));
    }
  }

  sqlite3* database_ = nullptr;
  sqlite3_stmt* statement_ = nullptr;
};

double elapsedMilliseconds(const std::chrono::steady_clock::time_point& startedAt) {
  const auto elapsed = std::chrono::steady_clock::now() - startedAt;
  return std::chrono::duration<double, std::milli>(elapsed).count();
}

std::string sequenceLabel(const std::string& sequence) {
  return sequence.empty() ? "<root>" : sequence;
}

std::string moveLabel(const Solver& solver) {
  const int moveCount = solver.getLegalMoveCount();
  const int moveIndex = solver.getCurrentMoveIndex();
  const int moveColumn = solver.getCurrentMoveColumn();

  if (moveCount <= 0 || moveIndex <= 0 || moveColumn <= 0) {
    return "-";
  }

  std::ostringstream out;
  out << moveIndex << "/" << moveCount << "(col=" << moveColumn << ")";
  return out.str();
}

std::string scoresJson(const std::vector<int>& scores) {
  std::ostringstream out;
  out << "[";
  for (std::size_t index = 0; index < scores.size(); ++index) {
    if (index != 0) {
      out << ",";
    }
    out << scores[index];
  }
  out << "]";
  return out.str();
}

std::pair<std::string, int> deriveBestMoves(const std::vector<int>& scores) {
  int bestScore = Solver::INVALID_MOVE;
  for (int score : scores) {
    if (score != Solver::INVALID_MOVE && score > bestScore) {
      bestScore = score;
    }
  }

  if (bestScore == Solver::INVALID_MOVE) {
    return {"", 0};
  }

  std::string bestMoves;
  for (std::size_t index = 0; index < scores.size(); ++index) {
    if (scores[index] == bestScore) {
      bestMoves.push_back(static_cast<char>('1' + static_cast<int>(index)));
    }
  }

  return {bestMoves, bestScore};
}

Position positionFromSequence(const std::string& sequence) {
  Position position;
  const unsigned int processedMoves = position.play(sequence);
  if (processedMoves != sequence.size()) {
    std::ostringstream message;
    message << "sequence becomes invalid at move " << (processedMoves + 1) << ": " << sequence;
    throw std::runtime_error(message.str());
  }
  return position;
}

std::vector<std::string> enumerateChildren(const std::string& sequence) {
  Position position = positionFromSequence(sequence);
  std::vector<std::string> children;
  children.reserve(Position::WIDTH);

  for (int column = 0; column < Position::WIDTH; ++column) {
    if (position.canPlay(column) && !position.isWinningMove(column)) {
      children.push_back(sequence + static_cast<char>('1' + column));
    }
  }

  return children;
}

SolveRecord solveSequenceRecord(Solver& solver, const std::string& sequence) {
  Position position = positionFromSequence(sequence);

  solver.reset();
  const auto startedAt = std::chrono::steady_clock::now();
  std::vector<int> scores = solver.analyze(position, false);

  auto [bestMoves, positionScore] = deriveBestMoves(scores);

  SolveRecord record;
  record.sequence = sequence;
  record.depth = static_cast<int>(sequence.size());
  record.bestMoves = bestMoves;
  record.scores = std::move(scores);
  record.positionScore = positionScore;
  record.nodeCount = solver.getNodeCount();
  record.elapsedMs = elapsedMilliseconds(startedAt);
  return record;
}

void execute(sqlite3* database, const char* sql) {
  char* errorMessage = nullptr;
  const int rc = sqlite3_exec(database, sql, nullptr, nullptr, &errorMessage);
  if (rc != SQLITE_OK) {
    const std::string message = errorMessage == nullptr ? sqlite3_errmsg(database) : errorMessage;
    sqlite3_free(errorMessage);
    throw std::runtime_error("sqlite exec failed: " + message);
  }
}

sqlite3* openDatabase(const std::string& path) {
  sqlite3* database = nullptr;
  const int rc = sqlite3_open(path.c_str(), &database);
  if (rc != SQLITE_OK) {
    const std::string message = database == nullptr ? "unknown sqlite open error" : sqlite3_errmsg(database);
    if (database != nullptr) {
      sqlite3_close(database);
    }
    throw std::runtime_error("unable to open sqlite database: " + message);
  }

  execute(database, "PRAGMA journal_mode=WAL;");
  execute(database, "PRAGMA synchronous=NORMAL;");
  return database;
}

void initDatabase(sqlite3* database) {
  execute(
      database,
      R"SQL(
        CREATE TABLE IF NOT EXISTS frontier (
          sequence TEXT PRIMARY KEY,
          depth INTEGER NOT NULL,
          expanded INTEGER NOT NULL DEFAULT 0,
          discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS frontier_pending_idx
          ON frontier(expanded, depth, sequence);

        CREATE TABLE IF NOT EXISTS solved_positions (
          sequence TEXT PRIMARY KEY,
          depth INTEGER NOT NULL,
          best_moves TEXT NOT NULL,
          scores_json TEXT NOT NULL,
          position_score INTEGER NOT NULL,
          node_count INTEGER NOT NULL,
          elapsed_ms REAL NOT NULL,
          solved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      )SQL");

  Statement insertRoot(database, "INSERT OR IGNORE INTO frontier (sequence, depth, expanded) VALUES (?, ?, 0)");
  insertRoot.bindText(1, "");
  insertRoot.bindInt(2, 0);
  insertRoot.stepDone();
}

std::optional<std::pair<std::string, int>> nextFrontierRow(sqlite3* database, int maxDepth) {
  Statement statement(
      database,
      "SELECT sequence, depth FROM frontier WHERE expanded = 0 AND depth <= ? ORDER BY depth, sequence LIMIT 1");
  statement.bindInt(1, maxDepth);
  if (!statement.stepRow()) {
    return std::nullopt;
  }

  const unsigned char* sequenceText = sqlite3_column_text(statement.get(), 0);
  const std::string sequence = sequenceText == nullptr ? "" : reinterpret_cast<const char*>(sequenceText);
  const int depth = sqlite3_column_int(statement.get(), 1);
  return std::make_pair(sequence, depth);
}

bool alreadySolved(sqlite3* database, const std::string& sequence) {
  Statement statement(database, "SELECT 1 FROM solved_positions WHERE sequence = ? LIMIT 1");
  statement.bindText(1, sequence);
  return statement.stepRow();
}

void storeRecord(sqlite3* database, const SolveRecord& record) {
  Statement statement(
      database,
      "INSERT OR REPLACE INTO solved_positions "
      "(sequence, depth, best_moves, scores_json, position_score, node_count, elapsed_ms) "
      "VALUES (?, ?, ?, ?, ?, ?, ?)");
  statement.bindText(1, record.sequence);
  statement.bindInt(2, record.depth);
  statement.bindText(3, record.bestMoves);
  statement.bindText(4, scoresJson(record.scores));
  statement.bindInt(5, record.positionScore);
  statement.bindInt64(6, static_cast<sqlite3_int64>(record.nodeCount));
  statement.bindDouble(7, record.elapsedMs);
  statement.stepDone();
}

int storeChildren(sqlite3* database, const std::string& sequence, int depth, int maxDepth) {
  if (depth >= maxDepth) {
    return 0;
  }

  const std::vector<std::string> children = enumerateChildren(sequence);
  Statement statement(database, "INSERT OR IGNORE INTO frontier (sequence, depth, expanded) VALUES (?, ?, 0)");
  int inserted = 0;
  for (const std::string& child : children) {
    sqlite3_reset(statement.get());
    sqlite3_clear_bindings(statement.get());
    statement.bindText(1, child);
    statement.bindInt(2, depth + 1);
    statement.stepDone();
    inserted += sqlite3_changes(database) > 0 ? 1 : 0;
  }
  return inserted;
}

void markExpanded(sqlite3* database, const std::string& sequence) {
  Statement statement(database, "UPDATE frontier SET expanded = 1 WHERE sequence = ?");
  statement.bindText(1, sequence);
  statement.stepDone();
}

int countQuery(sqlite3* database, const char* sql) {
  Statement statement(database, sql);
  if (!statement.stepRow()) {
    return 0;
  }
  return sqlite3_column_int(statement.get(), 0);
}

std::pair<int, int> frontierStats(sqlite3* database) {
  const int pending = countQuery(database, "SELECT COUNT(*) FROM frontier WHERE expanded = 0");
  const int solved = countQuery(database, "SELECT COUNT(*) FROM solved_positions");
  return {pending, solved};
}

void beginTransaction(sqlite3* database) {
  execute(database, "BEGIN IMMEDIATE TRANSACTION;");
}

void commitTransaction(sqlite3* database) {
  execute(database, "COMMIT;");
}

void rollbackTransaction(sqlite3* database) {
  execute(database, "ROLLBACK;");
}

class HeartbeatReporter {
 public:
  HeartbeatReporter(
      const Solver& solver,
      std::string sequence,
      int depth,
      int solved,
      int expanded,
      int pending,
      double heartbeatSeconds,
      std::chrono::steady_clock::time_point runStartedAt)
      : solver_(solver),
        sequence_(std::move(sequence)),
        depth_(depth),
        solved_(solved),
        expanded_(expanded),
        pending_(pending),
        heartbeatSeconds_(heartbeatSeconds),
        runStartedAt_(runStartedAt),
        rowStartedAt_(std::chrono::steady_clock::now()) {}

  ~HeartbeatReporter() {
    stop();
  }

  const std::chrono::steady_clock::time_point& rowStartedAt() const {
    return rowStartedAt_;
  }

  void start() {
    emit("Starting", solved_, expanded_, pending_);

    if (heartbeatSeconds_ <= 0) {
      return;
    }

    thread_ = std::thread([this]() { run(); });
  }

  void stop() {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      stopRequested_ = true;
    }
    condition_.notify_one();

    if (thread_.joinable()) {
      thread_.join();
    }
  }

  void emitCompleted(int solved, int expanded, int pending) const {
    emit("Completed", solved, expanded, pending);
  }

 private:
  void run() {
    std::unique_lock<std::mutex> lock(mutex_);
    while (!condition_.wait_for(
        lock,
        std::chrono::duration<double>(heartbeatSeconds_),
        [this]() { return stopRequested_; })) {
      lock.unlock();
      emit("Heartbeat", solved_, expanded_, pending_);
      lock.lock();
    }
  }

  void emit(const char* event, int solved, int expanded, int pending) const {
    const auto now = std::chrono::steady_clock::now();
    const double totalElapsed = std::chrono::duration<double>(now - runStartedAt_).count();
    const double rowElapsed = std::chrono::duration<double>(now - rowStartedAt_).count();
    const unsigned long long nodeCount = solver_.getNodeCount();
    const double nodesPerSecond = rowElapsed > 0.0 ? static_cast<double>(nodeCount) / rowElapsed : 0.0;

    std::ostringstream out;
    out << "[" << std::fixed << std::setw(8) << std::setprecision(1) << totalElapsed << "s] " << event << ": "
        << "sequence=" << sequenceLabel(sequence_) << " "
        << "depth=" << depth_ << " "
        << "move=" << moveLabel(solver_) << " "
        << "rowElapsed=" << std::setw(7) << std::setprecision(1) << rowElapsed << "s "
        << "nodes=" << nodeCount << " "
        << "nps=" << std::setw(9) << std::setprecision(0) << nodesPerSecond << " "
        << "solved=" << solved << " "
        << "expanded=" << expanded << " "
        << "pending=" << pending;

    std::cerr << out.str() << std::endl;
  }

  const Solver& solver_;
  const std::string sequence_;
  const int depth_;
  const int solved_;
  const int expanded_;
  const int pending_;
  const double heartbeatSeconds_;
  const std::chrono::steady_clock::time_point runStartedAt_;
  const std::chrono::steady_clock::time_point rowStartedAt_;
  mutable std::condition_variable condition_;
  mutable std::mutex mutex_;
  bool stopRequested_ = false;
  std::thread thread_;
};

void printSolveRecordJson(const SolveRecord& record) {
  std::cout << "{\n"
            << "  \"sequence\": \"" << record.sequence << "\",\n"
            << "  \"depth\": " << record.depth << ",\n"
            << "  \"best_moves\": \"" << record.bestMoves << "\",\n"
            << "  \"scores\": " << scoresJson(record.scores) << ",\n"
            << "  \"position_score\": " << record.positionScore << ",\n"
            << "  \"node_count\": " << record.nodeCount << ",\n"
            << "  \"elapsed_ms\": " << std::fixed << std::setprecision(3) << record.elapsedMs << "\n"
            << "}\n";
}

void printRunSummary(
    const Options& options,
    int discovered,
    int expanded,
    bool interrupted,
    int pending,
    int solved,
    int solvedThisRun) {
  std::cout << "{\n"
            << "  \"database\": \"" << options.databasePath << "\",\n"
            << "  \"batchSize\": " << options.batchSize << ",\n"
            << "  \"maxDepth\": " << options.maxDepth << ",\n"
            << "  \"discovered\": " << discovered << ",\n"
            << "  \"expanded\": " << expanded << ",\n"
            << "  \"interrupted\": " << (interrupted ? "true" : "false") << ",\n"
            << "  \"pending\": " << pending << ",\n"
            << "  \"solved\": " << solved << ",\n"
            << "  \"solvedThisRun\": " << solvedThisRun << "\n"
            << "}\n";
}

void printUsage() {
  std::cerr
      << "Usage:\n"
      << "  connect4-precompute [--database PATH] [--max-depth N] [--batch-size N] [--solve-root] [--book PATH]\n"
      << "  connect4-precompute --solve-sequence SEQUENCE [--book PATH]\n\n"
      << "Options:\n"
      << "  --database PATH       SQLite database path (default: data/connect4_cache.sqlite3)\n"
      << "  --max-depth N         Expand and solve positions up to this ply depth (default: 8)\n"
      << "  --batch-size N        Number of unsolved positions to solve in this run. 0 means keep going.\n"
      << "  --heartbeat-seconds N Print heartbeat progress this often while solving one position (default: 5).\n"
      << "  --solve-root          Also solve the empty root position instead of only expanding it.\n"
      << "  --book PATH           Optional opening book file to load into the solver.\n"
      << "  --solve-sequence SEQ  Solve one sequence and print JSON without touching SQLite.\n"
      << "  --help                Show this message.\n";
}

Options parseOptions(int argc, char** argv) {
  Options options;

  for (int index = 1; index < argc; ++index) {
    const std::string argument = argv[index];

    auto requireValue = [&](const char* flag) -> std::string {
      if (index + 1 >= argc) {
        throw std::runtime_error(std::string("missing value for ") + flag);
      }
      ++index;
      return argv[index];
    };

    if (argument == "--database") {
      options.databasePath = requireValue("--database");
    } else if (argument == "--max-depth") {
      options.maxDepth = std::stoi(requireValue("--max-depth"));
    } else if (argument == "--batch-size") {
      options.batchSize = std::stoi(requireValue("--batch-size"));
    } else if (argument == "--heartbeat-seconds") {
      options.heartbeatSeconds = std::stod(requireValue("--heartbeat-seconds"));
    } else if (argument == "--solve-root") {
      options.solveRoot = true;
    } else if (argument == "--book") {
      options.openingBookPath = requireValue("--book");
    } else if (argument == "--solve-sequence") {
      options.solveSequence = requireValue("--solve-sequence");
    } else if (argument == "--help" || argument == "-h") {
      printUsage();
      std::exit(0);
    } else {
      throw std::runtime_error("unknown argument: " + argument);
    }
  }

  if (options.batchSize < 0) {
    throw std::runtime_error("--batch-size must be 0 or greater");
  }
  if (options.heartbeatSeconds < 0) {
    throw std::runtime_error("--heartbeat-seconds must be 0 or greater");
  }
  if (options.maxDepth < 0 || options.maxDepth > Position::WIDTH * Position::HEIGHT) {
    throw std::runtime_error("--max-depth must be between 0 and 42");
  }

  return options;
}

}  // namespace

int main(int argc, char** argv) {
  try {
    const Options options = parseOptions(argc, argv);

    Solver solver;
    if (options.openingBookPath.has_value()) {
      solver.loadBook(*options.openingBookPath);
    }

    if (options.solveSequence.has_value()) {
      HeartbeatReporter reporter(
          solver,
          *options.solveSequence,
          static_cast<int>(options.solveSequence->size()),
          0,
          0,
          0,
          options.heartbeatSeconds,
          std::chrono::steady_clock::now());
      reporter.start();
      const SolveRecord record = solveSequenceRecord(solver, *options.solveSequence);
      reporter.stop();
      reporter.emitCompleted(1, 0, 0);
      printSolveRecordJson(record);
      return 0;
    }

    sqlite3* database = openDatabase(options.databasePath);
    try {
      initDatabase(database);

      int solvedThisRun = 0;
      int expandedThisRun = 0;
      int discoveredThisRun = 0;
      bool interrupted = false;
      const auto runStartedAt = std::chrono::steady_clock::now();

      while (options.batchSize == 0 || solvedThisRun < options.batchSize) {
        const auto frontierRow = nextFrontierRow(database, options.maxDepth);
        if (!frontierRow.has_value()) {
          break;
        }

        const std::string& sequence = frontierRow->first;
        const int depth = frontierRow->second;
        const auto [pendingBefore, ignoredSolvedCount] = frontierStats(database);
        (void)ignoredSolvedCount;
        solver.reset();
        HeartbeatReporter reporter(
            solver,
            sequence,
            depth,
            solvedThisRun,
            expandedThisRun,
            pendingBefore,
            options.heartbeatSeconds,
            runStartedAt);
        reporter.start();

        bool rowSolved = false;
        SolveRecord record;

        if ((options.solveRoot || !sequence.empty()) && !alreadySolved(database, sequence)) {
          record = solveSequenceRecord(solver, sequence);
          rowSolved = true;
        }

        try {
          beginTransaction(database);
          if (rowSolved) {
            storeRecord(database, record);
          }
          const int discovered = storeChildren(database, sequence, depth, options.maxDepth);
          markExpanded(database, sequence);
          commitTransaction(database);

          solvedThisRun += rowSolved ? 1 : 0;
          expandedThisRun += 1;
          discoveredThisRun += discovered;
        } catch (...) {
          interrupted = true;
          reporter.stop();
          try {
            rollbackTransaction(database);
          } catch (...) {
          }
          throw;
        }

        reporter.stop();
        const auto [pendingAfter, solvedAfter] = frontierStats(database);
        (void)solvedAfter;
        reporter.emitCompleted(solvedThisRun, expandedThisRun, pendingAfter);
      }

      const auto [pending, solved] = frontierStats(database);
      printRunSummary(options, discoveredThisRun, expandedThisRun, interrupted, pending, solved, solvedThisRun);
    } catch (...) {
      sqlite3_close(database);
      throw;
    }

    sqlite3_close(database);
    return 0;
  } catch (const std::exception& error) {
    std::cerr << "error: " << error.what() << std::endl;
    return 1;
  }
}
