import { utils, write } from 'xlsx';

import { buildMessages, buildRecipients, renderMessage, unknownVariables } from './recipients';
import { SpreadsheetError, guessPhoneColumn, readSheet, readWorkbook } from './spreadsheet';

function xlsxFile(rows: unknown[][], name = 'clientes.xlsx'): File {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), 'Clientes');
  const data = write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([data], name);
}

describe('Lectura de planillas', () => {
  it('lee cabeceras y filas; los teléfonos numéricos salen completos', async () => {
    const workbook = await readWorkbook(
      xlsxFile([
        ['Nombre', 'Celular', ''],
        ['Ana', 56912345678, 'x'],
        [],
        ['Luis', '+56 9 8765 4321', ''],
      ]),
    );
    const sheet = readSheet(workbook, 'Clientes');

    expect(sheet.headers).toEqual(['Nombre', 'Celular', 'Columna C']);
    expect(sheet.rows.length).toBe(2);
    expect(sheet.rows[0]['Celular']).toBe('56912345678');
    expect(sheet.rows[1]['Celular']).toBe('+56 9 8765 4321');
    expect(guessPhoneColumn(sheet.headers)).toBe('Celular');
  });

  it('en CSV mantiene el "+" y los ceros iniciales', async () => {
    const workbook = await readWorkbook(new File(['Nombre,Telefono\nAna,+56912345678\nLuis,0991234567\n'], 'c.csv'));
    const sheet = readSheet(workbook, workbook.SheetNames[0]);

    expect(sheet.rows.map((row) => row['Telefono'])).toEqual(['+56912345678', '0991234567']);
  });

  it('renombra cabeceras repetidas y rechaza hojas sin datos y tipos no permitidos', async () => {
    const workbook = await readWorkbook(xlsxFile([['Nombre', 'Nombre'], ['a', 'b']]));
    expect(readSheet(workbook, 'Clientes').headers).toEqual(['Nombre', 'Nombre (2)']);

    const empty = await readWorkbook(xlsxFile([['Solo cabecera']]));
    expect(() => readSheet(empty, 'Clientes')).toThrowError(SpreadsheetError);

    await expectAsync(readWorkbook(new File(['x'], 'datos.pdf'))).toBeRejectedWithError(SpreadsheetError);
  });
});

describe('Destinatarios y mensajes', () => {
  const sheet = {
    headers: ['Nombre', 'Teléfono'],
    rows: [
      { Nombre: 'Ana', Teléfono: '+56 9 1234 5678' },
      { Nombre: 'Sin número', Teléfono: '' },
      { Nombre: 'Ana repetida', Teléfono: '+56-9-1234-5678' },
      { Nombre: 'Luis', Teléfono: '+56987654321' },
    ],
  };

  it('omite vacíos y duplicados (ignorando espacios y guiones) y envía el teléfono tal cual', () => {
    const list = buildRecipients(sheet, 'Teléfono');

    expect(list.recipients.map((recipient) => recipient.phone)).toEqual(['+56 9 1234 5678', '+56987654321']);
    expect(list.emptyCount).toBe(1);
    expect(list.duplicateCount).toBe(1);
  });

  it('personaliza el mensaje con las columnas y detecta variables desconocidas', () => {
    expect(renderMessage('Hola {{ Nombre }}, tu número es {{Teléfono}}', sheet.rows[3])).toBe(
      'Hola Luis, tu número es +56987654321',
    );
    expect(unknownVariables('Hola {{Nombre}} {{Apellido}}', sheet.headers)).toEqual(['Apellido']);

    const [message] = buildMessages('Hola {{Nombre}}', buildRecipients(sheet, 'Teléfono').recipients);
    expect(message).toEqual({ phone: '+56 9 1234 5678', text: 'Hola Ana' });
  });
});
