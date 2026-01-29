"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type CellValue = string | number | null;

interface TableContextType {
  threadId: string | null;
  setThreadId: (id: string) => void;
  syncTableData: (data: CellValue[][], colHeaders?: string[]) => Promise<void>;
  fetchTableData: () => Promise<{ data: CellValue[][]; colHeaders: string[] } | null>;
}

const TableContext = createContext<TableContextType | null>(null);

export function TableProvider({ children }: { children: ReactNode }) {
  const [threadId, setThreadIdState] = useState<string | null>(null);

  const setThreadId = useCallback((id: string) => {
    setThreadIdState(id);
  }, []);

  const syncTableData = useCallback(
    async (data: CellValue[][], colHeaders?: string[]) => {
      if (!threadId) {
        console.warn("Cannot sync table data: no threadId set");
        return;
      }

      try {
        const response = await fetch("/api/table", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            data,
            colHeaders,
          }),
        });

        if (!response.ok) {
          throw new Error(`Sync failed: ${response.statusText}`);
        }
      } catch (error) {
        console.error("Failed to sync table data:", error);
      }
    },
    [threadId]
  );

  const fetchTableData = useCallback(async () => {
    if (!threadId) {
      console.warn("Cannot fetch table data: no threadId set");
      return null;
    }

    try {
      const response = await fetch(`/api/table?threadId=${encodeURIComponent(threadId)}`);
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch table data:", error);
      return null;
    }
  }, [threadId]);

  return (
    <TableContext.Provider
      value={{
        threadId,
        setThreadId,
        syncTableData,
        fetchTableData,
      }}
    >
      {children}
    </TableContext.Provider>
  );
}

export function useTableContext() {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error("useTableContext must be used within a TableProvider");
  }
  return context;
}
