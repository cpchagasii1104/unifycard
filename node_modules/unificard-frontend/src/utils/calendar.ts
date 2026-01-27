// frontend/src/utils/calendar.ts
// Utilitários para geração de arquivos de calendário (.ics)

/**
 * Gera arquivo .ics (iCalendar) para download
 */
export function generateICS(
  title: string,
  description: string | null,
  startDate: Date,
  endDate: Date,
  location: string | null
): string {
  // Formatar datas no formato iCalendar (YYYYMMDDTHHMMSSZ)
  const formatDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };

  // Escapar texto para iCalendar
  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const dtstart = formatDate(startDate);
  const dtend = formatDate(endDate);
  const dtstamp = formatDate(new Date());
  const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@unificard.app`;

  let ics = 'BEGIN:VCALENDAR\r\n';
  ics += 'VERSION:2.0\r\n';
  ics += 'PRODID:-//UnifiCard//Event Calendar//PT\r\n';
  ics += 'CALSCALE:GREGORIAN\r\n';
  ics += 'METHOD:PUBLISH\r\n';
  ics += 'BEGIN:VEVENT\r\n';
  ics += `UID:${uid}\r\n`;
  ics += `DTSTAMP:${dtstamp}\r\n`;
  ics += `DTSTART:${dtstart}\r\n`;
  ics += `DTEND:${dtend}\r\n`;
  ics += `SUMMARY:${escapeText(title)}\r\n`;
  
  if (description) {
    ics += `DESCRIPTION:${escapeText(description)}\r\n`;
  }
  
  if (location) {
    ics += `LOCATION:${escapeText(location)}\r\n`;
  }
  
  ics += 'STATUS:CONFIRMED\r\n';
  ics += 'SEQUENCE:0\r\n';
  ics += 'END:VEVENT\r\n';
  ics += 'END:VCALENDAR\r\n';

  return ics;
}

/**
 * Faz download do arquivo .ics
 */
export function downloadICS(
  title: string,
  description: string | null,
  startDate: Date,
  endDate: Date,
  location: string | null
): void {
  const icsContent = generateICS(title, description, startDate, endDate, location);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}



