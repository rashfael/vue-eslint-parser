import { Tokenizer as HTMLTokenizer } from "../html/tokenizer"
import type { Token, VText, OffsetRange } from "../ast"
import type {
    Token as PugToken,
    TagToken as PugTagToken,
    Loc as PugLoc,
} from "pug-lexer"
import { Lexer as PugLexer } from "pug-lexer"
import pugParse from "./pug-parser"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pugWalk = require("pug-walk")

/**
 *
 */
export class Tokenizer extends HTMLTokenizer {
    private pugLexer: any
    private bufferedHTMLTokens: Token[]
    private lineToOffset: number[]
    // private lastToken: any
    private htmlTokenIterator: Iterator<Token>

    /**
     * Initialize this tokenizer.
     * @param text The source code to tokenize.
     */
    public constructor(originalToken: VText, code: string) {
        super(code)
        this.pugLexer = new PugLexer(originalToken.value, {
            filename: "",
            startingLine: originalToken.loc.start.line,
            startingColumn: originalToken.loc.start.column + 1,
        })
        console.log(JSON.stringify(originalToken.value), originalToken.value[0] === "\n", originalToken.loc.start.line, originalToken.loc.start.column)
        this.bufferedHTMLTokens = []
        this.lineToOffset = []
        let lastOffset = 0
        for (const line of code.split("\n")) {
            this.lineToOffset.push(lastOffset)
            lastOffset += line.length + 1 // add \n again
        }
        const ast = pugParse(this.pugLexer.getTokens())

        // console.log('AST:', originalToken.value, JSON.stringify(ast, null, 2))

        const htmlTokens: Token[] = []

        const before = (node: any) => {
            switch (node.type) {
                case "Tag":
                    htmlTokens.push(
                        this.createTokenFromPugNode(
                            node,
                            "HTMLTagOpen",
                            node.name,
                        ),
                    )
                    for (const attr of node.attrs) {
                        htmlTokens.push(
                            this.createTokenFromPugNode(
                                attr,
                                "HTMLIdentifier",
                                attr.name,
                                // total hack
                                {
                                    start: {
                                        line: attr.loc.start.line,
                                        column: attr.loc.start.column,
                                    },
                                    end: {
                                        line: attr.loc.start.line,
                                        column:
                                            attr.loc.start.column +
                                            attr.name.length,
                                    },
                                }
                            ),
                        )
                        if (typeof attr.val === "string") {
                            // TODO check if we are in expression mode and emit different tokens
                            htmlTokens.push(
                                this.createTokenFromPugNode(
                                    attr,
                                    "HTMLLiteral",
                                    attr.val,
                                ),
                            )
                        }
                    }
                    htmlTokens.push(
                        this.createTokenFromPugNode(node, "HTMLTagClose", "", {
                            start: node.loc.end,
                            end: node.loc.end,
                        }),
                    )
                    break
                case "Block":
                    break
                default:
                    console.warn("UNHANDLED BEFORE NODE", node)
                    break
            }
            return true
        }

        const after = (node: any) => {
            switch (node.type) {
                case "Tag":
                    if (node.selfClosing) {
                        htmlTokens.push(
                            this.createTokenFromPugNode(
                                node,
                                "HTMLSelfClosingTagClose",
                                "",
                                {
                                    start: node.loc.end,
                                    end: node.loc.end,
                                },
                            ),
                        )
                    } else {
                        htmlTokens.push(
                            this.createTokenFromPugNode(
                                node,
                                "HTMLEndTagOpen",
                                node.name,
                                {
                                    start: node.loc.end,
                                    end: node.loc.end,
                                },
                            ),
                        )
                        htmlTokens.push(
                            this.createTokenFromPugNode(
                                node,
                                "HTMLTagClose",
                                "",
                                {
                                    start: node.loc.end,
                                    end: node.loc.end,
                                },
                            ),
                        )
                    }
                    break
                case "Block":
                    break
                default:
                    console.warn("UNHANDLED AFTER NODE", node)
                    break
            }
        }

        pugWalk(ast, before, after)
        this.htmlTokenIterator = htmlTokens[Symbol.iterator]()
        // console.log(JSON.stringify(htmlTokens, null, 2))
        for (const token of htmlTokens) {
            console.log(code.substring(token.range[0], token.range[1]), JSON.stringify(token))
        }
    }

    /**
     * Get the next token.
     * @returns The next token or null.
     */
    public nextToken(): Token | null {
        // TODO or just use pop()?
        return this.htmlTokenIterator.next().value
    }

    private createTokenFromPugNode(
        token: PugToken,
        type: string,
        value = "",
        loc = token.loc,
    ): Token {
        return {
            type,
            value,
            loc: {
                start: {
                    line: loc.start.line,
                    column: loc.start.column - 1,
                },
                end: {
                    line: loc.end.line,
                    column: loc.end.column - 1,
                },
            },
            range: this.getRangeFromPugLoc(loc),
        }
    }

    private getRangeFromPugLoc(loc: PugLoc): OffsetRange {
        return [
            this.lineToOffset[loc.start.line - 1] + loc.start.column - 1,
            this.lineToOffset[loc.end.line - 1] + loc.end.column - 1,
        ]
    }
}
