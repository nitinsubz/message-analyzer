import { NextRequest, NextResponse } from 'next/server';
import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';

// Helper function to normalize phone numbers for matching
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  return phone.replace(/\D/g, '');
}

// Helper function to parse vCard file
function parseVCard(vcardContent: string): Map<string, string> {
  const phoneToName = new Map<string, string>();
  
  // Normalize line endings and handle continuation lines (lines starting with space or tab)
  const normalized = vcardContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, ''); // Remove continuation lines
  
  // Split by BEGIN:VCARD to get individual contacts
  const contacts = normalized.split(/BEGIN:VCARD/i);
  
  for (const contact of contacts) {
    if (!contact.trim()) continue;
    
    // Extract name from FN (Full Name) or N (Name) field
    let name = '';
    
    // Try FN field first (Full Name - preferred)
    const fnMatch = contact.match(/FN[;:]?([^\n]*)/i);
    if (fnMatch) {
      name = fnMatch[1].trim();
      // Unescape vCard escaping
      name = name.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ').replace(/\\\\/g, '\\');
    }
    
    // Fallback to N field (Name - structured)
    if (!name) {
      const nMatch = contact.match(/^N[;:]?([^\n]*)/im);
      if (nMatch) {
        // N field format: Family;Given;Additional;Prefix;Suffix
        const nameParts = nMatch[1]
          .split(';')
          .map(p => p.trim())
          .filter(p => p);
        if (nameParts.length > 0) {
          // Combine Given + Family (most common format)
          const given = nameParts[1] || '';
          const family = nameParts[0] || '';
          name = [given, family].filter(p => p).join(' ').trim();
          // If still empty, use any non-empty part
          if (!name && nameParts.length > 0) {
            name = nameParts.find(p => p) || '';
          }
        }
      }
    }
    
    if (!name) continue;
    
    // Extract all phone numbers (TEL fields)
    const telMatches = contact.matchAll(/TEL[^:\n]*:([^\n]*)/gi);
    for (const match of telMatches) {
      let phone = match[1].trim();
      // Remove vCard escaping and clean up
      phone = phone.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ').replace(/\\\\/g, '\\');
      const normalizedPhone = normalizePhoneNumber(phone);
      
      if (normalizedPhone && normalizedPhone.length >= 10) {
        // Store with full number
        phoneToName.set(normalizedPhone, name);
        // Also store with last 10 digits (for US numbers with country code)
        if (normalizedPhone.length > 10) {
          phoneToName.set(normalizedPhone.slice(-10), name);
        }
        // Store with last 11 digits if it starts with 1 (US country code)
        if (normalizedPhone.length === 11 && normalizedPhone.startsWith('1')) {
          phoneToName.set(normalizedPhone.slice(1), name);
        }
      }
    }
  }
  
  return phoneToName;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const contactsFile = formData.get('contactsFile') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Parse contacts file if provided
    let phoneToNameMap = new Map<string, string>();
    if (contactsFile) {
      try {
        const contactsContent = await contactsFile.text();
        phoneToNameMap = parseVCard(contactsContent);
      } catch (error) {
        console.error('Error parsing contacts file:', error);
        // Continue without contacts if parsing fails
      }
    }

    // Helper function to get contact name from phone number
    const getContactName = (phoneNumber: string | null): string | null => {
      if (!phoneNumber) return null;
      const normalized = normalizePhoneNumber(phoneNumber);
      return phoneToNameMap.get(normalized) || phoneToNameMap.get(normalized.slice(-10)) || null;
    };

    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialize SQL.js with proper WASM file path
    // For server-side usage, we need to provide the WASM binary directly
    let wasmBinary: Buffer;
    try {
      // Try the standard path first (relative to process.cwd())
      const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      wasmBinary = await readFile(wasmPath);
    } catch (error) {
      // Fallback: use createRequire to resolve the module path
      try {
        const require = createRequire(path.join(process.cwd(), 'package.json'));
        const sqljsPath = require.resolve('sql.js');
        const sqljsDir = path.dirname(sqljsPath);
        const wasmPath = path.join(sqljsDir, '../dist/sql-wasm.wasm');
        wasmBinary = await readFile(wasmPath);
      } catch (altError) {
        throw new Error(
          `Could not find sql-wasm.wasm file. Tried: ${path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')}. ` +
          `Please ensure sql.js is properly installed. Error: ${(altError as Error).message}`
        );
      }
    }
    
    const SQL = await initSqlJs({
      wasmBinary: wasmBinary.buffer as ArrayBuffer,
    });

    // Load the database
    const db = new SQL.Database(new Uint8Array(buffer));

    // Query the database for messages
    // macOS Messages database structure
    const messagesQuery = `
      SELECT 
        m.ROWID,
        m.guid,
        m.text,
        m.date,
        m.date_read,
        m.is_from_me,
        m.handle_id,
        h.id as phone_number,
        c.chat_identifier,
        c.display_name,
        datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as readable_date
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      LEFT JOIN chat c ON cmj.chat_id = c.ROWID
      ORDER BY m.date DESC
    `;

    const messagesResult = db.exec(messagesQuery);
    const messages = messagesResult[0]?.values || [];

    // Get contacts/participants
    const contactsQuery = `
      SELECT DISTINCT
        h.ROWID,
        h.id as phone_number,
        COUNT(*) as message_count,
        SUM(CASE WHEN m.is_from_me = 0 THEN 1 ELSE 0 END) as received_count,
        SUM(CASE WHEN m.is_from_me = 1 THEN 1 ELSE 0 END) as sent_count
      FROM handle h
      LEFT JOIN message m ON h.ROWID = m.handle_id
      GROUP BY h.ROWID, h.id
      ORDER BY message_count DESC
    `;

    const contactsResult = db.exec(contactsQuery);
    const contacts = contactsResult[0]?.values || [];

    // Get daily message counts
    const dailyStatsQuery = `
      SELECT 
        date(datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime')) as day,
        COUNT(*) as count
      FROM message m
      GROUP BY day
      ORDER BY day DESC
      LIMIT 365
    `;

    const dailyStatsResult = db.exec(dailyStatsQuery);
    const dailyStats = dailyStatsResult[0]?.values || [];

    // Get hourly message distribution
    const hourlyStatsQuery = `
      SELECT 
        CAST(strftime('%H', datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime')) AS INTEGER) as hour,
        COUNT(*) as count
      FROM message m
      GROUP BY hour
      ORDER BY hour
    `;

    const hourlyStatsResult = db.exec(hourlyStatsQuery);
    const hourlyStats = hourlyStatsResult[0]?.values || [];

    // Calculate overall statistics
    const totalMessages = messages.length;
    const sentMessages = messages.filter((m: any) => m[5] === 1).length;
    const receivedMessages = messages.filter((m: any) => m[5] === 0).length;
    const uniqueContacts = contacts.length;

    // Format the data
    const formattedMessages = messages.map((msg: any) => {
      const phoneNumber = msg[7];
      const contactName = getContactName(phoneNumber);
      return {
        id: msg[0],
        guid: msg[1],
        text: msg[2],
        date: msg[3],
        dateRead: msg[4],
        isFromMe: msg[5] === 1,
        handleId: msg[6],
        phoneNumber: phoneNumber,
        contactName: contactName,
        chatIdentifier: msg[8],
        displayName: msg[9],
        readableDate: msg[10],
      };
    });

    const formattedContacts = contacts.map((contact: any) => {
      const phoneNumber = contact[1];
      const contactName = getContactName(phoneNumber);
      return {
        id: contact[0],
        phoneNumber: phoneNumber,
        contactName: contactName,
        messageCount: contact[2],
        receivedCount: contact[3],
        sentCount: contact[4],
      };
    });

    const formattedDailyStats = dailyStats.map((stat: any) => ({
      day: stat[0],
      count: stat[1],
    }));

    const formattedHourlyStats = hourlyStats.map((stat: any) => ({
      hour: stat[0],
      count: stat[1],
    }));

    db.close();

    return NextResponse.json({
      summary: {
        totalMessages,
        sentMessages,
        receivedMessages,
        uniqueContacts,
      },
      contacts: formattedContacts,
      dailyStats: formattedDailyStats,
      hourlyStats: formattedHourlyStats,
      messages: formattedMessages.slice(0, 100), // Limit to first 100 for performance
    });
  } catch (error: any) {
    console.error('Error analyzing chat.db:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze chat.db' },
      { status: 500 }
    );
  }
}

