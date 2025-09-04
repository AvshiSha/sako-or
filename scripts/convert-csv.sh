#!/bin/bash

# CSV to JSON Converter Script for Mac/Linux
# Usage: ./convert-csv.sh input.csv output.json

if [ $# -ne 2 ]; then
    echo "Usage: ./convert-csv.sh <input.csv> <output.json>"
    echo ""
    echo "Example:"
    echo "  ./convert-csv.sh my-products.csv my-products.json"
    exit 1
fi

echo "Converting CSV to JSON..."
node scripts/csv-to-json-converter.js "$1" "$2"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Conversion completed successfully!"
    echo "📁 Output file: $2"
    echo ""
    echo "You can now import this JSON file through your admin panel."
else
    echo ""
    echo "❌ Conversion failed. Please check the error messages above."
    exit 1
fi
