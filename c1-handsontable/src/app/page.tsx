"use client";

import "@crayonai/react-ui/styles/index.css";
import {
  C1Chat,
  ThemeProvider,
  useThreadListManager,
  useThreadManager,
} from "@thesysai/genui-sdk";
import { SpreadsheetTable } from "./components";
import { TableProvider, useTableContext } from "./TableContext";
import { useEffect } from "react";

function ChatWithTable() {
  const { setThreadId } = useTableContext();

  const threadListManager = useThreadListManager({
    fetchThreadList: async () => [],
    createThread: async () => {
      const id = crypto.randomUUID();
      return { 
        threadId: id, 
        title: "New Thread",
        createdAt: new Date(),
      };
    },
    deleteThread: async () => {},
    updateThread: async (thread) => thread,
    onSwitchToNew: () => {},
    onSelectThread: () => {},
  });

  const threadManager = useThreadManager({
    threadListManager,
    loadThread: async () => [],
    onUpdateMessage: async () => {},
    apiUrl: "/api/chat",
    customizeC1: {
      customComponents: { SpreadsheetTable },
    },
  });

  // Update context whenever the selected thread changes
  useEffect(() => {
    const selectedId = threadListManager.selectedThreadId;
    if (selectedId) {
      setThreadId(selectedId);
    }
  }, [threadListManager.selectedThreadId, setThreadId]);

  return (
    <C1Chat
      threadManager={threadManager}
      threadListManager={threadListManager}
      customizeC1={{
        customComponents: { SpreadsheetTable },
      }}
      welcomeMessage={{
        title: "Hi, I'm your Spreadsheet Assistant",
        description: "I can help you create, analyze, and work with data in Excel-like spreadsheets with formulas and calculations.",
      }}
      conversationStarters={{
        variant: "short",
        options: [
          { 
            displayText: "Create a sample budget", 
            prompt: "Create a sample monthly budget spreadsheet with income and expenses" 
          },
          { 
            displayText: "Sales data analysis", 
            prompt: "Create a sales data table with product names, quantities, prices, and calculate totals" 
          },
          { 
            displayText: "What can you do?", 
            prompt: "What can you help me with? Show me your capabilities" 
          },
          { 
            displayText: "Add formulas", 
            prompt: "Show me how to use formulas like SUM, AVERAGE, and IF in the spreadsheet" 
          },
        ],
      }}
    />
  );
}

export default function Home() {
  return (
    <ThemeProvider mode="dark">
      <TableProvider>
        <ChatWithTable />
      </TableProvider>
    </ThemeProvider>
  );
}
