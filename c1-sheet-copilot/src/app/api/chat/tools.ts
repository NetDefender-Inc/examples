import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.mjs";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { JSONSchema } from "openai/lib/jsonschema.mjs";
import {
  getTableData,
  updateCells,
  addRows,
  deleteRows,
  setFormula,
  queryTable,
  addColumn,
  CellValue,
} from "./tableStore";

// We'll store threadId in a module-level variable for tool execution
let currentThreadId: string = "";

export function setCurrentThreadId(threadId: string) {
  currentThreadId = threadId;
}

// Tool schemas using Zod
const updateCellsArgsSchema = z.object({
  updates: z
    .array(
      z.object({
        row: z.number().describe("Zero-based row index"),
        col: z.number().describe("Zero-based column index"),
        value: z
          .union([z.string(), z.number(), z.null()])
          .describe("New cell value. Can be a number, string, or formula (starting with =)"),
      })
    )
    .describe("Array of cell updates to apply"),
});

const addRowsArgsSchema = z.object({
  rows: z
    .array(z.array(z.union([z.string(), z.number(), z.null()])))
    .describe("Array of rows to add. Each row is an array of cell values."),
  position: z
    .number()
    .optional()
    .describe("Zero-based row index where to insert. If omitted, appends at the end."),
});

const deleteRowsArgsSchema = z.object({
  rowIndices: z
    .array(z.number())
    .describe("Array of zero-based row indices to delete"),
});

const setFormulaArgsSchema = z.object({
  row: z.number().describe("Zero-based row index"),
  col: z.number().describe("Zero-based column index"),
  formula: z
    .string()
    .describe(
      "Excel-like formula. Examples: =SUM(A1:A5), =AVERAGE(B:B), =IF(A1>100,'High','Low'), =VLOOKUP(A1,B:C,2,FALSE)"
    ),
});

const queryTableArgsSchema = z.object({
  columnIndex: z.number().describe("Zero-based column index to query"),
  operator: z
    .enum(["=", "!=", ">", "<", ">=", "<=", "contains"])
    .describe("Comparison operator"),
  value: z
    .union([z.string(), z.number()])
    .describe("Value to compare against"),
});

const addColumnArgsSchema = z.object({
  headerName: z.string().describe("Name for the new column header"),
  position: z
    .number()
    .optional()
    .describe("Zero-based column index where to insert. If omitted, appends at the end."),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tools: RunnableToolFunctionWithParse<any>[] = [
  {
    type: "function",
    function: {
      name: "get_table_data",
      description:
        "Get the current table data including all cell values, formulas, and column headers. Call this first to see the current state of the spreadsheet.",
      parse: (input) => JSON.parse(input),
      parameters: {
        type: "object",
        properties: {},
        required: [],
      } as JSONSchema,
      function: async () => {
        const result = getTableData(currentThreadId);
        return JSON.stringify({
          success: true,
          colHeaders: result.colHeaders,
          data: result.data,
          rowCount: result.data.length,
          colCount: result.colHeaders.length,
          message: `Table has ${result.data.length} rows and ${result.colHeaders.length} columns`,
        });
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_cells",
      description:
        "Update one or more cells in the table. Supports setting values (numbers, strings) or formulas (starting with =). Use Excel-style formulas like =SUM(A1:A5), =AVERAGE(B:B), =IF(condition, true_value, false_value).",
      parse: (input) => updateCellsArgsSchema.parse(JSON.parse(input)),
      parameters: zodToJsonSchema(updateCellsArgsSchema) as JSONSchema,
      function: async (args: z.infer<typeof updateCellsArgsSchema>) => {
        const result = updateCells(
          currentThreadId,
          args.updates as { row: number; col: number; value: CellValue }[]
        );
        return JSON.stringify(result);
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_rows",
      description:
        "Add one or more new rows to the table. Each row should be an array of cell values matching the column count.",
      parse: (input) => addRowsArgsSchema.parse(JSON.parse(input)),
      parameters: zodToJsonSchema(addRowsArgsSchema) as JSONSchema,
      function: async (args: z.infer<typeof addRowsArgsSchema>) => {
        const result = addRows(currentThreadId, args.rows as CellValue[][], args.position);
        return JSON.stringify(result);
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_rows",
      description: "Delete one or more rows from the table by their indices.",
      parse: (input) => deleteRowsArgsSchema.parse(JSON.parse(input)),
      parameters: zodToJsonSchema(deleteRowsArgsSchema) as JSONSchema,
      function: async (args: z.infer<typeof deleteRowsArgsSchema>) => {
        const result = deleteRows(currentThreadId, args.rowIndices);
        return JSON.stringify(result);
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_formula",
      description:
        "Set an Excel-like formula in a specific cell. Supports 386+ functions including SUM, AVERAGE, IF, VLOOKUP, COUNT, MAX, MIN, CONCATENATE, and more.",
      parse: (input) => setFormulaArgsSchema.parse(JSON.parse(input)),
      parameters: zodToJsonSchema(setFormulaArgsSchema) as JSONSchema,
      function: async (args: z.infer<typeof setFormulaArgsSchema>) => {
        const result = setFormula(currentThreadId, args.row, args.col, args.formula);
        return JSON.stringify(result);
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_table",
      description:
        "Query the table to find rows matching a condition. Useful for filtering data.",
      parse: (input) => queryTableArgsSchema.parse(JSON.parse(input)),
      parameters: zodToJsonSchema(queryTableArgsSchema) as JSONSchema,
      function: async (args: z.infer<typeof queryTableArgsSchema>) => {
        const result = queryTable(
          currentThreadId,
          args.columnIndex,
          args.operator,
          args.value
        );
        return JSON.stringify(result);
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_column",
      description: "Add a new column to the table with the specified header name.",
      parse: (input) => addColumnArgsSchema.parse(JSON.parse(input)),
      parameters: zodToJsonSchema(addColumnArgsSchema) as JSONSchema,
      function: async (args: z.infer<typeof addColumnArgsSchema>) => {
        const result = addColumn(currentThreadId, args.headerName, args.position);
        return JSON.stringify(result);
      },
    },
  },
];
