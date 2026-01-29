// In-memory table data store with thread-based isolation

export type CellValue = string | number | null;
export type TableData = CellValue[][];

export interface TableState {
  data: TableData;
  colHeaders: string[];
}

// Default sample data with formulas
const DEFAULT_TABLE_STATE: TableState = {
  colHeaders: ["Product", "Q1 Sales", "Q2 Sales", "Q3 Sales", "Q4 Sales", "Total"],
  data: [
    ["Widget A", 1500, 1800, 2100, 2400, "=SUM(B1:E1)"],
    ["Widget B", 1200, 1400, 1600, 1900, "=SUM(B2:E2)"],
    ["Gadget X", 800, 950, 1100, 1300, "=SUM(B3:E3)"],
    ["Gadget Y", 600, 750, 900, 1050, "=SUM(B4:E4)"],
    ["Service A", 2000, 2200, 2500, 2800, "=SUM(B5:E5)"],
    ["Total", "=SUM(B1:B5)", "=SUM(C1:C5)", "=SUM(D1:D5)", "=SUM(E1:E5)", "=SUM(F1:F5)"],
    ["Average", "=AVERAGE(B1:B5)", "=AVERAGE(C1:C5)", "=AVERAGE(D1:D5)", "=AVERAGE(E1:E5)", "=AVERAGE(F1:F5)"],
  ],
};

// Thread-based table storage
const tableStores: Map<string, TableState> = new Map();

export function getTableStore(threadId: string): TableState {
  if (!tableStores.has(threadId)) {
    // Deep clone the default state for each new thread
    tableStores.set(threadId, {
      colHeaders: [...DEFAULT_TABLE_STATE.colHeaders],
      data: DEFAULT_TABLE_STATE.data.map((row) => [...row]),
    });
  }
  return tableStores.get(threadId)!;
}

export function getTableData(threadId: string): { data: TableData; colHeaders: string[] } {
  const store = getTableStore(threadId);
  return {
    data: store.data,
    colHeaders: store.colHeaders,
  };
}

export function updateCells(
  threadId: string,
  updates: { row: number; col: number; value: CellValue }[]
): { success: boolean; message: string } {
  const store = getTableStore(threadId);

  for (const update of updates) {
    const { row, col, value } = update;

    // Validate indices
    if (row < 0 || col < 0) {
      return { success: false, message: `Invalid cell position: row ${row}, col ${col}` };
    }

    // Expand data if needed
    while (store.data.length <= row) {
      store.data.push(new Array(store.colHeaders.length).fill(null));
    }
    while (store.data[row].length <= col) {
      store.data[row].push(null);
    }

    store.data[row][col] = value;
  }

  return { success: true, message: `Updated ${updates.length} cell(s)` };
}

export function addRows(
  threadId: string,
  rows: CellValue[][],
  position?: number
): { success: boolean; message: string; newRowIndices: number[] } {
  const store = getTableStore(threadId);

  const insertPosition = position !== undefined ? position : store.data.length;
  const newRowIndices: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Pad row to match column count
    while (row.length < store.colHeaders.length) {
      row.push(null);
    }
    store.data.splice(insertPosition + i, 0, row);
    newRowIndices.push(insertPosition + i);
  }

  return {
    success: true,
    message: `Added ${rows.length} row(s) at position ${insertPosition}`,
    newRowIndices,
  };
}

export function deleteRows(
  threadId: string,
  rowIndices: number[]
): { success: boolean; message: string } {
  const store = getTableStore(threadId);

  // Sort in descending order to delete from end first
  const sortedIndices = [...rowIndices].sort((a, b) => b - a);

  for (const index of sortedIndices) {
    if (index >= 0 && index < store.data.length) {
      store.data.splice(index, 1);
    }
  }

  return { success: true, message: `Deleted ${rowIndices.length} row(s)` };
}

export function setFormula(
  threadId: string,
  row: number,
  col: number,
  formula: string
): { success: boolean; message: string } {
  const store = getTableStore(threadId);

  // Ensure formula starts with =
  const normalizedFormula = formula.startsWith("=") ? formula : `=${formula}`;

  // Validate indices
  if (row < 0 || row >= store.data.length) {
    return { success: false, message: `Invalid row index: ${row}` };
  }
  if (col < 0 || col >= store.colHeaders.length) {
    return { success: false, message: `Invalid column index: ${col}` };
  }

  store.data[row][col] = normalizedFormula;

  return {
    success: true,
    message: `Set formula "${normalizedFormula}" at row ${row}, col ${col}`,
  };
}

export function queryTable(
  threadId: string,
  columnIndex: number,
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains",
  value: string | number
): { success: boolean; matchingRows: { rowIndex: number; data: CellValue[] }[]; message: string } {
  const store = getTableStore(threadId);
  const matchingRows: { rowIndex: number; data: CellValue[] }[] = [];

  for (let i = 0; i < store.data.length; i++) {
    const row = store.data[i];
    const cellValue = row[columnIndex];

    // Skip formula cells for querying (they need to be evaluated client-side)
    if (typeof cellValue === "string" && cellValue.startsWith("=")) {
      continue;
    }

    let matches = false;
    switch (operator) {
      case "=":
        matches = cellValue === value;
        break;
      case "!=":
        matches = cellValue !== value;
        break;
      case ">":
        matches = typeof cellValue === "number" && typeof value === "number" && cellValue > value;
        break;
      case "<":
        matches = typeof cellValue === "number" && typeof value === "number" && cellValue < value;
        break;
      case ">=":
        matches = typeof cellValue === "number" && typeof value === "number" && cellValue >= value;
        break;
      case "<=":
        matches = typeof cellValue === "number" && typeof value === "number" && cellValue <= value;
        break;
      case "contains":
        matches =
          typeof cellValue === "string" &&
          typeof value === "string" &&
          cellValue.toLowerCase().includes(value.toLowerCase());
        break;
    }

    if (matches) {
      matchingRows.push({ rowIndex: i, data: [...row] });
    }
  }

  return {
    success: true,
    matchingRows,
    message: `Found ${matchingRows.length} matching row(s)`,
  };
}

export function addColumn(
  threadId: string,
  headerName: string,
  position?: number
): { success: boolean; message: string } {
  const store = getTableStore(threadId);

  const insertPosition = position !== undefined ? position : store.colHeaders.length;

  // Add header
  store.colHeaders.splice(insertPosition, 0, headerName);

  // Add null cell to each row at the new column position
  for (const row of store.data) {
    row.splice(insertPosition, 0, null);
  }

  return {
    success: true,
    message: `Added column "${headerName}" at position ${insertPosition}`,
  };
}

export function updateColumnHeaders(
  threadId: string,
  headers: string[]
): { success: boolean; message: string } {
  const store = getTableStore(threadId);
  store.colHeaders = headers;
  return { success: true, message: "Updated column headers" };
}
