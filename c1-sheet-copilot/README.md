# C1 Handsontable - AI-Powered Spreadsheet

An Excel-like spreadsheet with AI capabilities using [Thesys C1](https://thesys.dev) and [Handsontable](https://handsontable.com).

## Features

- **Excel-like Spreadsheet**: Full-featured data grid with cell editing, selection, copy/paste
- **Formula Support**: 386+ Excel-compatible formulas via HyperFormula (SUM, AVERAGE, IF, VLOOKUP, etc.)
- **AI-Powered Operations**: Ask the AI to:
  - View and analyze table data
  - Update cells with values or formulas
  - Add/delete rows and columns
  - Query and filter data
  - Apply complex formulas
- **Real-time Updates**: Formulas automatically recalculate when data changes
- **Context Menu**: Right-click for row/column operations

## Getting Started

### Prerequisites

- Node.js 18+
- A Thesys API key ([get one here](https://platform.thesys.dev))

### Installation

```bash
# Install dependencies
npm install
# or
pnpm install

# Copy environment file and add your API key
cp env.example .env.local
# Edit .env.local and add your THESYS_API_KEY

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Examples

Try these prompts with the AI assistant:

1. **View data**: "Show me the current spreadsheet data"
2. **Update cells**: "Change the Q1 Sales for Widget A to 2000"
3. **Add formulas**: "Add a formula to calculate the percentage growth between Q1 and Q4"
4. **Add rows**: "Add a new product called 'Widget C' with Q1=500, Q2=600, Q3=700, Q4=800"
5. **Query data**: "Find all products with Q4 sales greater than 1500"
6. **Complex formulas**: "Add a column that shows the average quarterly sales for each product"

## Sample Data

The spreadsheet starts with sample sales data:

| Product   | Q1 Sales | Q2 Sales | Q3 Sales | Q4 Sales | Total        |
|-----------|----------|----------|----------|----------|--------------|
| Widget A  | 1500     | 1800     | 2100     | 2400     | =SUM(B1:E1)  |
| Widget B  | 1200     | 1400     | 1600     | 1900     | =SUM(B2:E2)  |
| Gadget X  | 800      | 950      | 1100     | 1300     | =SUM(B3:E3)  |
| ...       | ...      | ...      | ...      | ...      | ...          |

## Supported Formulas

HyperFormula supports 386+ Excel-compatible functions including:

- **Math**: SUM, AVERAGE, COUNT, MAX, MIN, ROUND, ABS, etc.
- **Logical**: IF, AND, OR, NOT, TRUE, FALSE
- **Lookup**: VLOOKUP, HLOOKUP, INDEX, MATCH
- **Text**: CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER
- **Date/Time**: TODAY, NOW, DATE, YEAR, MONTH, DAY
- **Statistical**: MEDIAN, MODE, STDEV, VAR

[Full function list](https://hyperformula.handsontable.com/guide/built-in-functions.html)

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework
- [Thesys C1](https://thesys.dev) - Generative UI SDK
- [Handsontable](https://handsontable.com) - Data grid component
- [HyperFormula](https://hyperformula.handsontable.com/) - Formula calculation engine
- [Tailwind CSS](https://tailwindcss.com) - Styling

## Project Structure

```
c1-handsontable/
├── src/
│   ├── app/
│   │   ├── api/chat/
│   │   │   ├── route.ts         # API endpoint with C1 integration
│   │   │   ├── tools.ts         # AI tools for table operations
│   │   │   ├── tableStore.ts    # In-memory table data store
│   │   │   └── messageStore.ts  # Conversation history
│   │   ├── components.tsx       # SpreadsheetTable component
│   │   ├── page.tsx             # Main page
│   │   ├── layout.tsx
│   │   └── globals.css
├── package.json
└── README.md
```

## License

This example uses Handsontable's non-commercial evaluation license. For production use, you'll need a [commercial license](https://handsontable.com/pricing).
