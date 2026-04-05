CXX := clang++
CXXFLAGS := -std=c++17 -O3 -DNDEBUG -Wall -Wextra -pedantic
LDFLAGS := -lsqlite3

BIN_DIR := ../bin
SOLVER_DIR := solver
TARGET := $(BIN_DIR)/connect4-precompute

all: $(TARGET)

$(TARGET): connect4_precompute.cpp $(SOLVER_DIR)/Solver.cpp
	mkdir -p $(BIN_DIR)
	$(CXX) $(CXXFLAGS) -I$(SOLVER_DIR) connect4_precompute.cpp $(SOLVER_DIR)/Solver.cpp $(LDFLAGS) -o $(TARGET)

clean:
	rm -f $(TARGET)
