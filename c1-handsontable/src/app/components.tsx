"use client";

import "@crayonai/react-ui/styles/index.css";
import "handsontable/styles/handsontable.css";
import "handsontable/styles/ht-theme-main.css";
import { useOnAction, useC1State } from "@thesysai/genui-sdk";
import { useEffect, useRef, useCallback, useState } from "react";
import type { CellChange, ChangeSource } from "handsontable/common";

type CellValue = string | number | null;

interface SpreadsheetTableProps {
  data: CellValue[][];
  colHeaders?: string[];
  height?: number;
  title?: string;
}

// Lazy-loaded Handsontable component to avoid SSR issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let HotTable: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let HyperFormula: any = null;
let modulesLoaded = false;

export const SpreadsheetTable = ({
  data,
  colHeaders,
  height = 400,
  title,
}: SpreadsheetTableProps) => {
  const onAction = useOnAction();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hotRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);

  // Use C1 state to persist table data across renders
  const { getValue, setValue } = useC1State("spreadsheetData");

  // Initialize state with props data if not already set
  const currentData: CellValue[][] = getValue() || data;

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

  // Update state when new data comes from props
  useEffect(() => {
    if (data && JSON.stringify(data) !== JSON.stringify(getValue())) {
      setValue(data);
    }
  }, [data, getValue, setValue]);

  // Safe wrapper for onAction that catches errors
  const safeOnAction = useCallback(
    (humanMessage: string, llmMessage: string) => {
      try {
        if (onAction) {
          onAction(humanMessage, llmMessage);
        }
      } catch (error) {
        // Silently ignore errors - the action context might not be ready
        console.debug("onAction not available:", error);
      }
    },
    [onAction]
  );

  // Handle cell changes - only sync data, don't trigger action for every change
  const handleAfterChange = useCallback(
    (changes: CellChange[] | null, source: ChangeSource) => {
      if (!changes || source === "loadData") return;

      const hotInstance = hotRef.current?.hotInstance;
      if (!hotInstance) return;

      // Get the updated data from Handsontable
      const newData = hotInstance.getData() as CellValue[][];
      setValue(newData);

      // Only notify AI for user-initiated edits, not internal operations
      if (source === "edit") {
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
    [colHeaders, safeOnAction, setValue]
  );

  // Handle row/column operations - only sync data without triggering action
  // This prevents errors when the C1 context isn't ready
  const handleAfterCreateRow = useCallback(
    (_index: number, _amount: number) => {
      const hotInstance = hotRef.current?.hotInstance;
      if (hotInstance) {
        setValue(hotInstance.getData() as CellValue[][]);
      }
    },
    [setValue]
  );

  const handleAfterRemoveRow = useCallback(
    (_index: number, _amount: number) => {
      const hotInstance = hotRef.current?.hotInstance;
      if (hotInstance) {
        setValue(hotInstance.getData() as CellValue[][]);
      }
    },
    [setValue]
  );

  const handleAfterCreateCol = useCallback(
    (_index: number, _amount: number) => {
      const hotInstance = hotRef.current?.hotInstance;
      if (hotInstance) {
        setValue(hotInstance.getData() as CellValue[][]);
      }
    },
    [setValue]
  );

  const handleAfterRemoveCol = useCallback(
    (_index: number, _amount: number) => {
      const hotInstance = hotRef.current?.hotInstance;
      if (hotInstance) {
        setValue(hotInstance.getData() as CellValue[][]);
      }
    },
    [setValue]
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
            {currentData.length} rows × {colHeaders?.length || currentData[0]?.length || 0} columns
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
          data={currentData}
          colHeaders={colHeaders || true}
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
          {currentData.length} rows × {colHeaders?.length || currentData[0]?.length || 0} columns
        </span>
        <span>Right-click for options • Formulas supported (=SUM, =AVERAGE, etc.)</span>
      </div>
    </div>
  );
};
