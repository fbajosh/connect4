const boardGrid = document.getElementById("board-grid");

if (!boardGrid) {
  throw new Error("Missing required board container.");
}

for (let index = 0; index < 42; index += 1) {
  const cell = document.createElement("div");
  cell.className = "board-cell";
  boardGrid.append(cell);
}
