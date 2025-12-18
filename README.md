# 💬 Chat Analyzer

A web application to analyze your macOS Messages chat.db file and get detailed statistics about your messages.

## Features

- 📊 **Comprehensive Statistics**: Total messages, sent/received counts, unique contacts
- 📈 **Visual Analytics**: Daily message activity charts and hourly distribution graphs
- 👥 **Contact Analysis**: See who you text the most with message counts
- 📅 **Time-based Insights**: Understand your messaging patterns over time

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm or yarn

### Installation

1. Navigate to the project directory:
```bash
cd chat-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## How to Use

1. **Find your chat.db file**:
   - Open Finder
   - Press `Cmd + Shift + G` (Go to Folder)
   - Enter: `~/Library/Messages/`
   - Copy the `chat.db` file

2. **Upload the file**:
   - Drag and drop the `chat.db` file onto the upload area, or
   - Click "Select File" and browse to your chat.db file

3. **View your statistics**:
   - After uploading, click "Analyze"
   - Wait for the analysis to complete
   - Explore your message statistics, charts, and top contacts

## Privacy

- All file processing happens on your local machine (or server)
- No data is sent to external services
- The chat.db file is processed in memory and not stored permanently

## Technical Details

- Built with Next.js 16 and TypeScript
- Uses sql.js for SQLite database parsing
- Recharts for data visualization
- Tailwind CSS for styling

## Troubleshooting

If you encounter issues:

1. **File not found**: Make sure you're copying the correct `chat.db` file from `~/Library/Messages/`
2. **Analysis fails**: Ensure the file is not corrupted and is a valid SQLite database
3. **Large files**: Very large chat.db files may take longer to process

## License

MIT
