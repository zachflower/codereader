import AdmZip from 'adm-zip';
import * as xml2js from 'xml2js';
import * as path from 'path';

export interface BookChapter {
    title: string;
    content: string; // Plain text
}

export interface Book {
    title: string;
    author: string;
    chapters: BookChapter[];
}

const NAMED_ENTITIES: Record<string, string> = {
    'amp': '&', 'lt': '<', 'gt': '>', 'nbsp': ' ',
    'quot': '"', 'apos': "'", 'mdash': '\u2014', 'ndash': '\u2013',
    'lsquo': '\u2018', 'rsquo': '\u2019', 'ldquo': '\u201C', 'rdquo': '\u201D',
    'hellip': '\u2026', 'eacute': '\u00E9', 'egrave': '\u00E8', 'agrave': '\u00E0',
    'ccedil': '\u00E7', 'ouml': '\u00F6', 'uuml': '\u00FC', 'iuml': '\u00EF',
    'copy': '\u00A9', 'reg': '\u00AE', 'trade': '\u2122',
    'sect': '\u00A7', 'para': '\u00B6', 'deg': '\u00B0',
    'frac12': '\u00BD', 'frac14': '\u00BC', 'frac34': '\u00BE',
};

export class EpubParser {
    private zip: AdmZip;

    constructor(filePath: string) {
        this.zip = new AdmZip(filePath);
    }

    async parse(): Promise<Book> {
        // 1. Find container.xml to locate content.opf
        const containerXml = this.readText('META-INF/container.xml');
        if (!containerXml) {
            throw new Error('Invalid EPUB: Missing META-INF/container.xml');
        }

        const containerData = await this.parseXml(containerXml);
        const rootFile = this.asString(containerData?.container?.rootfiles?.[0]?.rootfile?.[0]?.$?.['full-path']);
        if (!rootFile) {
            throw new Error('Invalid EPUB: Missing rootfile full-path in META-INF/container.xml');
        }

        // 2. Parse content.opf
        const contentOpf = this.readText(rootFile);
        if (!contentOpf) {
            throw new Error(`Invalid EPUB: Missing ${rootFile}`);
        }

        const opfData = await this.parseXml(contentOpf);
        const metadata = opfData?.package?.metadata?.[0] ?? {};
        const manifest = Array.isArray(opfData?.package?.manifest?.[0]?.item)
            ? opfData.package.manifest[0].item
            : [];
        const spine = Array.isArray(opfData?.package?.spine?.[0]?.itemref)
            ? opfData.package.spine[0].itemref
            : [];

        const title = this.asString(metadata['dc:title']?.[0]) ?? 'Unknown Title';
        const author = this.asString(metadata['dc:creator']?.[0]) ?? 'Unknown Author';

        // 3. Map spine items to file paths
        const manifestMap: { [id: string]: string } = {};
        for (const item of manifest) {
            const id = this.asString(item?.$?.id);
            const href = this.asString(item?.$?.href);
            if (id && href) {
                manifestMap[id] = href;
            }
        }

        const baseDir = path.dirname(rootFile);
        const chapters: BookChapter[] = [];

        // 4. Extract content from spine items
        let chapterCounter = 1;
        for (const itemRef of spine) {
            const id = this.asString(itemRef?.$?.idref);
            if (!id) continue;

            const href = manifestMap[id];
            if (!href) continue;

            const fullPath = path.join(baseDir, href).replace(/\\/g, '/');
            const content = this.readText(fullPath);
            if (content) {
                const text = this.extractTextFromHtml(content);
                // Simple heuristic to ignore empty/nav chapters
                if (text.trim().length > 0) {
                    chapters.push({
                        title: `Chapter ${chapterCounter++}`, // TODO: Try to find real title
                        content: text
                    });
                }
            }
        }

        return { title, author, chapters };
    }

    private readText(entryName: string): string | null {
        const entry = this.zip.getEntry(entryName);
        return entry ? this.zip.readAsText(entry) : null;
    }

    private asString(value: unknown): string | null {
        if (typeof value === 'string') {
            return value;
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        if (value && typeof value === 'object' && '_' in value) {
            const text = (value as { _: unknown })._;
            return this.asString(text);
        }

        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private parseXml(xml: string): Promise<any> {
        return xml2js.parseStringPromise(xml);
    }

    private extractTextFromHtml(html: string): string {
        // Replace closing block-level tags with paragraph breaks
        let text = html.replace(/<\/(p|div|h[1-6]|li|blockquote|section|article)>|<br\s*\/?>/gi, '\n\n');
        // Strip all remaining tags
        text = text.replace(/<[^>]+>/g, '');
        // Decode HTML entities (named, decimal, and hex)
        text = text.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g, (match, dec, hex, named) => {
            if (dec) { return String.fromCharCode(Number(dec)); }
            if (hex) { return String.fromCharCode(parseInt(hex, 16)); }
            return NAMED_ENTITIES[named] ?? match;
        });
        // Collapse horizontal whitespace within lines
        text = text.replace(/[ \t]+/g, ' ');
        return text.replace(/\n{3,}/g, '\n\n').trim();
    }
}
