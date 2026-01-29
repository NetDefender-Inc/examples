import { NextRequest, NextResponse } from "next/server";
import {
  getTableData,
  updateCells,
  addRows,
  deleteRows,
  CellValue,
  TableData,
  getTableStore,
} from "../chat/tableStore";

// GET - Fetch current table state for a thread
export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("threadId");

  if (!threadId) {
    return NextResponse.json(
      { error: "threadId is required" },
      { status: 400 }
    );
  }

  const tableData = getTableData(threadId);
  return NextResponse.json(tableData);
}

// POST - Sync entire table data from frontend
export async function POST(req: NextRequest) {
  try {
    const { threadId, data, colHeaders } = (await req.json()) as {
      threadId: string;
      data: TableData;
      colHeaders?: string[];
    };

    if (!threadId) {
      return NextResponse.json(
        { error: "threadId is required" },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "data is required" },
        { status: 400 }
      );
    }

    // Get the store and update it
    const store = getTableStore(threadId);
    store.data = data;
    if (colHeaders) {
      store.colHeaders = colHeaders;
    }

    return NextResponse.json({
      success: true,
      message: "Table data synced successfully",
    });
  } catch (error) {
    console.error("Error syncing table data:", error);
    return NextResponse.json(
      { error: "Failed to sync table data" },
      { status: 500 }
    );
  }
}

// PATCH - Apply specific updates (cells, rows, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { threadId, action, payload } = body as {
      threadId: string;
      action: "updateCells" | "addRows" | "deleteRows" | "syncFull";
      payload: unknown;
    };

    if (!threadId) {
      return NextResponse.json(
        { error: "threadId is required" },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "updateCells": {
        const updates = payload as { row: number; col: number; value: CellValue }[];
        result = updateCells(threadId, updates);
        break;
      }
      case "addRows": {
        const { rows, position } = payload as {
          rows: CellValue[][];
          position?: number;
        };
        result = addRows(threadId, rows, position);
        break;
      }
      case "deleteRows": {
        const { rowIndices } = payload as { rowIndices: number[] };
        result = deleteRows(threadId, rowIndices);
        break;
      }
      case "syncFull": {
        const { data, colHeaders } = payload as {
          data: TableData;
          colHeaders?: string[];
        };
        const store = getTableStore(threadId);
        store.data = data;
        if (colHeaders) {
          store.colHeaders = colHeaders;
        }
        result = { success: true, message: "Full sync completed" };
        break;
      }
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Return updated table state along with result
    const updatedData = getTableData(threadId);
    return NextResponse.json({
      ...result,
      tableData: updatedData,
    });
  } catch (error) {
    console.error("Error processing table update:", error);
    return NextResponse.json(
      { error: "Failed to process table update" },
      { status: 500 }
    );
  }
}
