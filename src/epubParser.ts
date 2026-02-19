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

export class EpubParser {
    private zip: AdmZip;
    private parser: xml2js.Parser;

    constructor(filePath: string) {
        this.zip = new AdmZip(filePath);
        this.parser = new xml2js.Parser();
    }

    async parse(): Promise<Book> {
        // 1. Find container.xml to locate content.opf
        const containerXml = this.readText('META-INF/container.xml');
        if (!containerXml) {
            throw new Error('Invalid EPUB: Missing META-INF/container.xml');
        }

        const containerData = await this.parseXml(containerXml);
        const rootFile = containerData.container.rootfiles[0].rootfile[0].$['full-path'];

        // 2. Parse content.opf
        const contentOpf = this.readText(rootFile);
        if (!contentOpf) {
            throw new Error(`Invalid EPUB: Missing ${rootFile}`);
        }

        const opfData = await this.parseXml(contentOpf);
        const metadata = opfData.package.metadata[0];
        const manifest = opfData.package.manifest[0].item;
        const spine = opfData.package.spine[0].itemref;

        const title = metadata['dc:title']?.[0] || 'Unknown Title';
        const author = metadata['dc:creator']?.[0]?._ || metadata['dc:creator']?.[0] || 'Unknown Author';

        // 3. Map spine items to file paths
        const manifestMap: { [id: string]: string } = {};
        for (const item of manifest) {
            manifestMap[item.$.id] = item.$.href;
        }

        const baseDir = path.dirname(rootFile);
        const chapters: BookChapter[] = [];

        // 4. Extract content from spine items
        let chapterCounter = 1;
        for (const itemRef of spine) {
            const id = itemRef.$.idref;
            const href = manifestMap[id];
            if (!href) continue;

            const fullPath = path.join(baseDir, href).replace(/\\/g, '/');
            const content = this.readText(fullPath);
            if (content) {
                const text = await this.extractTextFromHtml(content);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private parseXml(xml: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.parser.parseString(xml, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    private async extractTextFromHtml(html: string): Promise<string> {
        // Very basic HTML text extraction. 
        // We can improve this to respect <p> tags for line breaks.
        // For now, let's just strip tags.
        return html.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n\n').trim();
    }
}
