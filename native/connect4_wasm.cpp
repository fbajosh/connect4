#include <chrono>
#include <sstream>
#include <string>
#include <vector>

#include <emscripten/emscripten.h>

#include "Solver.hpp"

using namespace GameSolver::Connect4;

namespace {

Solver solver;
std::string lastResult;

std::string jsonEscape(const std::string& value) {
  std::string escaped;
  escaped.reserve(value.size());

  for (char character : value) {
    switch (character) {
      case '\\':
        escaped += "\\\\";
        break;
      case '"':
        escaped += "\\\"";
        break;
      case '\n':
        escaped += "\\n";
        break;
      case '\r':
        escaped += "\\r";
        break;
      case '\t':
        escaped += "\\t";
        break;
      default:
        escaped += character;
        break;
    }
  }

  return escaped;
}

std::string intArrayToJson(const std::vector<int>& values) {
  std::ostringstream output;
  output << "[";
  for (std::size_t index = 0; index < values.size(); ++index) {
    if (index != 0) {
      output << ",";
    }
    output << values[index];
  }
  output << "]";
  return output.str();
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

std::string bestColumnsToJson(const std::string& bestMoves) {
  std::ostringstream output;
  output << "[";
  for (std::size_t index = 0; index < bestMoves.size(); ++index) {
    if (index != 0) {
      output << ",";
    }
    output << (bestMoves[index] - '0');
  }
  output << "]";
  return output.str();
}

std::string errorJson(const std::string& sequence, const std::string& message, int invalidAtMove = 0) {
  std::ostringstream output;
  output << "{"
         << "\"sequence\":\"" << jsonEscape(sequence) << "\","
         << "\"error\":\"" << jsonEscape(message) << "\"";

  if (invalidAtMove > 0) {
    output << ",\"invalidAtMove\":" << invalidAtMove;
  }

  output << "}";
  return output.str();
}

}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE const char* connect4_analyze_json(const char* rawSequence) {
  const std::string sequence = rawSequence == nullptr ? "" : rawSequence;

  if (sequence.empty()) {
    lastResult =
        "{"
        "\"sequence\":\"\","
        "\"bestMoves\":\"\","
        "\"bestColumns\":[],"
        "\"message\":\"No moves yet.\","
        "\"positionScore\":0,"
        "\"scores\":[]"
        "}";
    return lastResult.c_str();
  }

  Position position;
  const unsigned int processedMoves = position.play(sequence);
  if (processedMoves != sequence.size()) {
    lastResult = errorJson(
        sequence,
        "Sequence stopped being analyzable.",
        static_cast<int>(processedMoves + 1));
    return lastResult.c_str();
  }

  solver.reset();
  const auto startedAt = std::chrono::steady_clock::now();
  const std::vector<int> scores = solver.analyze(position, false);
  const double elapsedMs =
      std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - startedAt).count();
  const auto [bestMoves, positionScore] = deriveBestMoves(scores);

  std::ostringstream output;
  output << "{"
         << "\"sequence\":\"" << jsonEscape(sequence) << "\","
         << "\"bestMoves\":\"" << bestMoves << "\","
         << "\"bestColumns\":" << bestColumnsToJson(bestMoves) << ","
         << "\"positionScore\":" << positionScore << ","
         << "\"scores\":" << intArrayToJson(scores) << ","
         << "\"nodeCount\":" << solver.getNodeCount() << ","
         << "\"elapsedMs\":" << elapsedMs
         << "}";

  lastResult = output.str();
  return lastResult.c_str();
}

}
