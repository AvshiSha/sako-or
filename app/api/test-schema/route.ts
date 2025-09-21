import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read the schema file directly
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Extract the datasource section
    const datasourceMatch = schemaContent.match(/datasource db \{[^}]*\}/s);
    const datasourceSection = datasourceMatch ? datasourceMatch[0] : 'Not found';
    
    return NextResponse.json({
      schemaPath,
      datasourceSection,
      fullSchema: schemaContent,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to read schema',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
