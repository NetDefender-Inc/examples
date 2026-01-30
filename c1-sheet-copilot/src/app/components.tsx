"use client";

import "@crayonai/react-ui/styles/index.css";
import "handsontable/styles/handsontable.css";
import "handsontable/styles/ht-theme-main.css";
import { useOnAction } from "@thesysai/genui-sdk";
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
  height?: number;
  title?: string;
}

// Lazy-loaded Handsontable component to avoid SSR issues
let HotTable: any = null;
let HyperFormula: any = null;
let modulesLoaded = false;

export const SpreadsheetTable = ({
  data: initialData,
  colHeaders: initialColHeaders,
  height = 400,
  title,
}: SpreadsheetTableProps) => {
  const onAction = useOnAction();
  const { syncTableData } = useTableContext();
  const hotRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Track props data to detect AI updates
  const lastPropsDataRef = useRef<string>(JSON.stringify(initialData));
  const lastPropsHeadersRef = useRef<string>(JSON.stringify(initialColHeaders));
  
  // Track if we're currently syncing to prevent loops
  const isSyncingRef = useRef(false);

  // Store colHeaders in ref for use in callbacks
  const colHeadersRef = useRef(initialColHeaders);
  colHeadersRef.current = initialColHeaders;

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

  // Save data to backend
  const saveData = useCallback(
    async (data: CellValue[][]) => {
      if (isSyncingRef.current) return;

      try {
        isSyncingRef.current = true;
        await syncTableData(data, colHeadersRef.current);
      } catch (error) {
        console.error("Failed to save table data:", error);
      } finally {
        isSyncingRef.current = false;
      }
    },
    [syncTableData]
  );

  // Load initial data after Handsontable mounts
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot || isInitialized) return;

    // Load initial data with a deep clone to ensure mutability
    const mutableData = deepClone(initialData);
    hot.loadData(mutableData);
    
    // Update column headers
    if (initialColHeaders) {
      hot.updateSettings({ colHeaders: initialColHeaders });
    }
    
    setIsInitialized(true);
    
    // Sync to backend
    saveData(initialData);
  }, [isClient, initialData, initialColHeaders, isInitialized, saveData]);

  // Handle prop changes (AI updates) after initial load
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot || !isInitialized) return;

    const propsDataStr = JSON.stringify(initialData);
    const propsHeadersStr = JSON.stringify(initialColHeaders);
    
    // Check if data actually changed
    if (propsDataStr !== lastPropsDataRef.current) {
      lastPropsDataRef.current = propsDataStr;
      
      // Load new data with a deep clone
      const mutableData = deepClone(initialData);
      hot.loadData(mutableData);
      
      // Sync to backend
      saveData(initialData);
    }
    
    // Update column headers if changed
    if (propsHeadersStr !== lastPropsHeadersRef.current) {
      lastPropsHeadersRef.current = propsHeadersStr;
      hot.updateSettings({ colHeaders: initialColHeaders || true });
    }
  }, [initialData, initialColHeaders, isInitialized, saveData]);

  // Safe wrapper for onAction that catches errors
  const safeOnAction = useCallback(
    (humanMessage: string, llmMessage: string) => {
      try {
        if (onAction) {
          onAction(humanMessage, llmMessage);
        }
      } catch (error) {
        console.debug("onAction not available:", error);
      }
    },
    [onAction]
  );

  // Autosave after changes
  const handleAfterChange = useCallback(
    (changes: CellChange[] | null, source: ChangeSource) => {
      // Skip saving on initial data load
      if (source === "loadData") {
        return;
      }

      if (!changes) return;

      const hot = hotRef.current?.hotInstance;
      if (!hot) return;

      // Get all data and save it
      const allData = hot.getData() as CellValue[][];
      saveData(allData);

      // Notify AI about user edits
      if (source === "edit") {
        const colHeaders = colHeadersRef.current;
        const changeDescriptions = changes.map(([row, col, oldVal, newVal]) => {
          const colName =
            colHeaders && typeof col === "number" ? colHeaders[col] : `Column ${col}`;
          return `Cell at row ${row + 1}, ${colName}: "${oldVal}" → "${newVal}"`;
        });

        safeOnAction(
          "Cell Updated",
          `User made the following changes to the spreadsheet:\n${changeDescriptions.join("\n")}`
        );
      }
    },
    [saveData, safeOnAction]
  );

  // Handle row creation
  const handleAfterCreateRow = useCallback(
    (index: number, amount: number) => {
      const hot = hotRef.current?.hotInstance;
      if (hot) {
        saveData(hot.getData() as CellValue[][]);
        safeOnAction(
          "Rows Added",
          `User added ${amount} row(s) at position ${index + 1}`
        );
      }
    },
    [saveData, safeOnAction]
  );

  // Handle row removal
  const handleAfterRemoveRow = useCallback(
    (index: number, amount: number) => {
      const hot = hotRef.current?.hotInstance;
      if (hot) {
        saveData(hot.getData() as CellValue[][]);
        safeOnAction(
          "Rows Removed",
          `User removed ${amount} row(s) starting at position ${index + 1}`
        );
      }
    },
    [saveData, safeOnAction]
  );

  // Handle column creation
  const handleAfterCreateCol = useCallback(
    (index: number, amount: number) => {
      const hot = hotRef.current?.hotInstance;
      if (hot) {
        saveData(hot.getData() as CellValue[][]);
        safeOnAction(
          "Columns Added",
          `User added ${amount} column(s) at position ${index + 1}`
        );
      }
    },
    [saveData, safeOnAction]
  );

  // Handle column removal
  const handleAfterRemoveCol = useCallback(
    (index: number, amount: number) => {
      const hot = hotRef.current?.hotInstance;
      if (hot) {
        saveData(hot.getData() as CellValue[][]);
        safeOnAction(
          "Columns Removed",
          `User removed ${amount} column(s) starting at position ${index + 1}`
        );
      }
    },
    [saveData, safeOnAction]
  );

  // Show loading state while Handsontable is loading
  if (!isClient || !HotTable || !HyperFormula) {
    return (
      <div className="w-full rounded-xl border border-white/10 bg-gradient-to-b from-neutral-900/80 to-black/60 p-4 shadow-xl">
        {title && (
          <h3 className="mb-4 text-lg font-semibold tracking-tight text-neutral-100">
            {title}
          </h3>
        )}
        <div
          className="flex items-center justify-center rounded-lg bg-neutral-800/50"
          style={{ height }}
        >
          <div className="text-neutral-400">Loading spreadsheet...</div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
          <span>
            {initialData.length} rows × {initialColHeaders?.length || initialData[0]?.length || 0} columns
          </span>
          <span>Right-click for options • Formulas supported (=SUM, =AVERAGE, etc.)</span>
        </div>
      </div>
    );
  }

  const HotTableComponent = HotTable;
  const HyperFormulaEngine = HyperFormula;

  return (
    <div className="w-full rounded-xl border border-white/10 bg-gradient-to-b from-neutral-900/80 to-black/60 p-4 shadow-xl">
      {title && (
        <h3 className="mb-4 text-lg font-semibold tracking-tight text-neutral-100">
          {title}
        </h3>
      )}
      <div className="overflow-hidden rounded-lg">
        <HotTableComponent
          ref={hotRef}
          startRows={initialData.length}
          startCols={initialColHeaders?.length || initialData[0]?.length || 6}
          colHeaders={initialColHeaders || true}
          rowHeaders={true}
          height={height}
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
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
        <span>
          {initialData.length} rows × {initialColHeaders?.length || initialData[0]?.length || 0} columns
        </span>
        <span>Right-click for options • Formulas supported (=SUM, =AVERAGE, etc.)</span>
      </div>
    </div>
  );
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
  const [isClient, setIsClient] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Track context data to detect updates from AI
  const lastContextDataRef = useRef<string>("");

  // Track if we're currently syncing to prevent loops
  const isSyncingRef = useRef(false);

  // Store colHeaders in ref for use in callbacks
  const colHeadersRef = useRef<string[] | undefined>(tableData?.colHeaders);

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
        <h2 className="text-lg font-semibold text-neutral-100">Spreadsheet</h2>
        <p className="text-xs text-neutral-400 mt-1">
          {currentData.length} rows × {currentHeaders?.length || currentData[0]?.length || 0} columns
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <HotTableComponent
          ref={hotRef}
          startRows={currentData.length}
          startCols={currentHeaders?.length || currentData[0]?.length || 6}
          colHeaders={currentHeaders || true}
          rowHeaders={true}
          height="100%"
          width="100%"
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
