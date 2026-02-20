import { LanguageGenerator, LanguageId, TextEmit, INDENT } from './base';

const METHODS = ['processText', 'readPassage', 'consume'] as const;
const VARS    = ['content', 'buffer', 'segment', 'data'] as const;

export class ObjectiveCGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'objectivec';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [
            `// ${title}`,
            `// By ${author}`,
            '',
            `#import <Foundation/Foundation.h>`
        ];
    }

    protected classOpen(className: string): string[] {
        return [
            `@interface ${className} : NSObject`,
            `@property (nonatomic, assign) NSInteger currentChapter;`,
            `@end`,
            '',
            `@implementation ${className}`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`- (void)chapter${index} {`];
    }

    protected chapterClose(): string[] {
        return [`}`];
    }

    protected chapterEmpty(): string[] {
        return [`    // empty`, `}`];
    }

    protected entryPoint(className: string): string[] {
        return [
            `@end`,
            '',
            `int main(int argc, const char * argv[]) {`,
            `    @autoreleasepool {`,
            `        ${className} *book = [[${className} alloc] init];`,
            `        [book read];`,
            `    }`,
            `    return 0;`,
            `}`
        ];
    }

    protected renderTextLine(text: string, escaped: string, mode: number, variant: number): TextEmit {
        switch (mode) {
            case 0: {
                const prefix = `${INDENT}// `;
                return { line: `${prefix}${text}`, textStart: prefix.length, textEnd: prefix.length + text.length };
            }
            case 1: {
                const method = this.methodNames[variant % this.methodNames.length];
                const prefix = `${INDENT}[self ${method}:@"`;
                return { line: `${prefix}${escaped}"];`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            case 2: {
                const prefix = `${INDENT} * `;
                return {
                    before: [`${INDENT}/*`],
                    line: `${prefix}${text}`,
                    textStart: prefix.length,
                    textEnd: prefix.length + text.length,
                    after: [`${INDENT} */`]
                };
            }
            case 3: {
                const varName = this.varNames[variant % this.varNames.length];
                const prefix = `${INDENT}NSString *${varName} = @"`;
                return { line: `${prefix}${escaped}";`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${INDENT}NSLog(@"`;
                return { line: `${prefix}${escaped}");`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}
