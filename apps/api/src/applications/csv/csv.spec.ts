import { CsvParseError, parseCsv, protectCell, toCsv, unprotectCell } from "./csv";

const cells = (text: string) => parseCsv(text).map((record) => record.cells);

describe("parseCsv", () => {
  it("splits plain records with CRLF or LF endings", () => {
    expect(cells("a,b\r\nc,d\ne,f")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });

  it("handles quoted fields, escaped quotes, commas and line breaks inside quotes", () => {
    expect(cells('"x, y","say ""hi""","line 1\nline 2"')).toEqual([["x, y", 'say "hi"', "line 1\nline 2"]]);
  });

  it("drops a leading BOM, blank lines and the trailing newline", () => {
    expect(cells("\uFEFFa,b\n\n\nc,d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps empty cells and a quoted empty record", () => {
    expect(cells('a,,c\n""')).toEqual([["a", "", "c"], [""]]);
  });

  it("reports the line each record starts on, counting line breaks inside quotes", () => {
    const records = parseCsv('h\n"multi\nline"\n\nlast');
    expect(records.map((r) => r.line)).toEqual([1, 2, 5]);
  });

  it("throws on an unclosed quote, pointing at where it opened", () => {
    expect(() => parseCsv('a\n"open\nstill open')).toThrow(new CsvParseError("Unclosed quote", 2));
  });

  it("throws on text right after a closing quote", () => {
    expect(() => parseCsv('"a"b')).toThrow(CsvParseError);
  });
});

describe("protectCell / unprotectCell", () => {
  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "\tx"])("prefixes formula-like %p and reverses it", (value) => {
    expect(protectCell(value)).toBe(`'${value}`);
    expect(unprotectCell(protectCell(value))).toBe(value);
  });

  it("leaves ordinary text and plain apostrophes alone", () => {
    expect(protectCell("Backend Engineer")).toBe("Backend Engineer");
    expect(unprotectCell("'quoted'")).toBe("'quoted'");
  });
});

describe("toCsv", () => {
  it("writes a BOM, CRLF endings and quotes only where needed", () => {
    expect(toCsv([["a", "b, c"], ['say "hi"', "x\ny"]])).toBe('\uFEFFa,"b, c"\r\n"say ""hi""","x\ny"\r\n');
  });

  it("protects formula-like cells", () => {
    expect(toCsv([["=1+1"]])).toBe("\uFEFF'=1+1\r\n");
  });

  it("round-trips through parseCsv", () => {
    const rows = [
      ["position", "notes"],
      ["Geliştirici, Backend", 'Görüşme "iyi" geçti\r\nsonraki adım: teklif'],
    ];
    expect(cells(toCsv(rows))).toEqual(rows);
  });
});
