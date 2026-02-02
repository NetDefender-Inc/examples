"use client";

import "@crayonai/react-ui/styles/index.css";
import "handsontable/styles/handsontable.css";
import "handsontable/styles/ht-theme-main.css";
import { useEffect, useRef, useCallback, useState } from "react";
import type { CellChange, ChangeSource } from "handsontable/common";
import { useTableContext } from "./TableContext";

type CellValue = string | number | null;

// Deep clone to create mutable arrays that Handsontable can modify
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

interface SpreadsheetTableProps {
  data: CellValue[][];
  colHeaders?: string[];
}

// Lazy-loaded Handsontable component to avoid SSR issues
let HotTable: any = null;
let HyperFormula: any = null;
let modulesLoaded = false;

// SpreadsheetTable: Syncs AI-generated data to the persistent spreadsheet (no visible rendering in chat)
export const SpreadsheetTable = ({
  data: initialData,
  colHeaders: initialColHeaders,
}: SpreadsheetTableProps) => {
  const { syncTableData } = useTableContext();
  const hasSyncedRef = useRef(false);
  const lastDataRef = useRef<string>("");

  // Sync data to context whenever props change
  useEffect(() => {
    const dataStr = JSON.stringify({ data: initialData, colHeaders: initialColHeaders });
    
    // Only sync if data actually changed
    if (dataStr !== lastDataRef.current) {
      lastDataRef.current = dataStr;
      syncTableData(initialData, initialColHeaders);
      hasSyncedRef.current = true;
    }
  }, [initialData, initialColHeaders, syncTableData]);

  // Render nothing - data is shown in the persistent spreadsheet panel
  return null;
};

// Default empty spreadsheet data
const DEFAULT_DATA: CellValue[][] = [
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
];

// Persistent spreadsheet component that displays data from TableContext
export const PersistentSpreadsheet = () => {
  const { tableData, syncTableData } = useTableContext();
  const hotRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [containerHeight, setContainerHeight] = useState(400);

  // Track context data to detect updates from AI
  const lastContextDataRef = useRef<string>("");

  // Track if we're currently syncing to prevent loops
  const isSyncingRef = useRef(false);

  // Store colHeaders in ref for use in callbacks
  const colHeadersRef = useRef<string[] | undefined>(tableData?.colHeaders);

  // Calculate container height on mount and resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height > 0 ? rect.height : 400);
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    
    // Also update after a short delay to handle initial render
    const timeout = setTimeout(updateHeight, 100);
    
    return () => {
      window.removeEventListener("resize", updateHeight);
      clearTimeout(timeout);
    };
  }, [isClient]);

  // Load Handsontable only on client side
  useEffect(() => {
    const loadHandsontable = async () => {
      if (typeof window !== "undefined" && !modulesLoaded) {
        const [hotModule, hfModule, registryModule] = await Promise.all([
          import("@handsontable/react-wrapper"),
          import("hyperformula"),
          import("handsontable/registry"),
        ]);

        HotTable = hotModule.HotTable;
        HyperFormula = hfModule.HyperFormula;
        registryModule.registerAllModules();
        modulesLoaded = true;

        setIsClient(true);
      } else if (modulesLoaded) {
        setIsClient(true);
      }
    };

    loadHandsontable();
  }, []);

  // Save data to context and backend
  const saveData = useCallback(
    async (data: CellValue[][], colHeaders?: string[]) => {
      if (isSyncingRef.current) return;

      try {
        isSyncingRef.current = true;
        await syncTableData(data, colHeaders || colHeadersRef.current);
      } catch (error) {
        console.error("Failed to save table data:", error);
      } finally {
        isSyncingRef.current = false;
      }
    },
    [syncTableData]
  );

  // Initialize with default or context data
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot || isInitialized) return;

    const data = tableData?.data || DEFAULT_DATA;
    const colHeaders = tableData?.colHeaders;
    
    const mutableData = deepClone(data);
    hot.loadData(mutableData);
    
    if (colHeaders) {
      hot.updateSettings({ colHeaders });
      colHeadersRef.current = colHeaders;
    }
    
    lastContextDataRef.current = JSON.stringify(tableData);
    setIsInitialized(true);
  }, [isClient, tableData, isInitialized]);

  // Handle context data changes (from AI updates via chat)
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot || !isInitialized || isSyncingRef.current) return;

    const contextDataStr = JSON.stringify(tableData);
    
    // Only update if context data actually changed (from AI)
    if (contextDataStr !== lastContextDataRef.current && tableData?.data) {
      lastContextDataRef.current = contextDataStr;
      
      const mutableData = deepClone(tableData.data);
      hot.loadData(mutableData);
      
      if (tableData.colHeaders) {
        hot.updateSettings({ colHeaders: tableData.colHeaders });
        colHeadersRef.current = tableData.colHeaders;
      }
    }
  }, [tableData, isInitialized]);

  // Autosave after changes
  const handleAfterChange = useCallback(
    (changes: CellChange[] | null, source: ChangeSource) => {
      if (source === "loadData") return;
      if (!changes) return;

      const hot = hotRef.current?.hotInstance;
      if (!hot) return;

      const allData = hot.getData() as CellValue[][];
      saveData(allData);
    },
    [saveData]
  );

  // Handle row creation
  const handleAfterCreateRow = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      saveData(hot.getData() as CellValue[][]);
    }
  }, [saveData]);

  // Handle row removal
  const handleAfterRemoveRow = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      saveData(hot.getData() as CellValue[][]);
    }
  }, [saveData]);

  // Handle column creation
  const handleAfterCreateCol = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      saveData(hot.getData() as CellValue[][]);
    }
  }, [saveData]);

  // Handle column removal
  const handleAfterRemoveCol = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      saveData(hot.getData() as CellValue[][]);
    }
  }, [saveData]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const exportPlugin = hot.getPlugin('exportFile');
    exportPlugin?.downloadFile('csv', {
      bom: false,
      columnDelimiter: ',',
      columnHeaders: true,
      exportHiddenColumns: true,
      exportHiddenRows: true,
      fileExtension: 'csv',
      filename: 'Spreadsheet_[YYYY]-[MM]-[DD]',
      mimeType: 'text/csv',
      rowDelimiter: '\r\n',
      rowHeaders: false,
    });
  }, []);

  // Show loading state while Handsontable is loading
  if (!isClient || !HotTable || !HyperFormula) {
    return (
      <div className="persistent-spreadsheet h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-neutral-900/50 rounded-lg">
          <div className="text-neutral-400">Loading spreadsheet...</div>
        </div>
      </div>
    );
  }

  const HotTableComponent = HotTable;
  const HyperFormulaEngine = HyperFormula;
  const currentData = tableData?.data || DEFAULT_DATA;
  const currentHeaders = tableData?.colHeaders;

  return (
    <div className="persistent-spreadsheet h-full flex flex-col">
      <div className="flex-none px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100">Spreadsheet</h2>
            <p className="text-xs text-neutral-400 mt-1">
              {currentData.length} rows × {currentHeaders?.length || currentData[0]?.length || 0} columns
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-100 rounded-md transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden">
        <HotTableComponent
          ref={hotRef}
          startRows={currentData.length}
          startCols={currentHeaders?.length || currentData[0]?.length || 6}
          colHeaders={currentHeaders || true}
          rowHeaders={true}
          height={containerHeight}
          stretchH="all"
          formulas={{
            engine: HyperFormulaEngine,
          }}
          contextMenu={[
            "row_above",
            "row_below",
            "---------",
            "col_left",
            "col_right",
            "---------",
            "remove_row",
            "remove_col",
            "---------",
            "undo",
            "redo",
            "---------",
            "copy",
            "cut",
          ]}
          manualColumnResize={true}
          manualRowResize={true}
          autoWrapRow={true}
          autoWrapCol={true}
          afterChange={handleAfterChange}
          afterCreateRow={handleAfterCreateRow}
          afterRemoveRow={handleAfterRemoveRow}
          afterCreateCol={handleAfterCreateCol}
          afterRemoveCol={handleAfterRemoveCol}
          className="htDark"
          licenseKey="non-commercial-and-evaluation"
        />
      </div>
      <div className="flex-none px-4 py-2 border-t border-white/10 text-xs text-neutral-400">
        Right-click for options • Formulas supported (=SUM, =AVERAGE, etc.)
      </div>
    </div>
  );
};
