# Unkindle

This program creates a PDF version of books from Kindle for personal use. It utilizes the Kindle Mac Desktop application, takes screenshots of each page, and produces a PDF containing all the pages.

I created this program to train an Agent to answer questions about the books I read. I found it nearly impossible to extract PDF versions of the books from Kindle.

[!demo](https://github.com/user-attachments/assets/5d71bd55-e59a-46a1-b5ba-5325b6f4d9d6)

## Prerequisites

- Node.js 16 or higher
- macOS (the program uses macOS-specific screenshot and window management features)
- Kindle for Mac desktop application

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

## Usage

1. Open your book in the Kindle for Mac application
2. Run the program:

```bash
npm start
```

3. Follow the prompts to:
   - Select an existing book or create a new one
   - Choose starting page
   - Set number of pages to capture

4. During capture:
   - Press 'c' to stop capturing and create PDF
   - Press 'Esc' or Ctrl+C to cancel everything

The program will create a PDF in the `books/<book_title>` directory.

## Note

This tool is for personal use only. Please respect copyright laws and Amazon's terms of service.

## License

This project is licensed under the MIT License, see the [LICENSE](LICENSE) file for details.# unkindle
