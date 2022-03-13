// FIRST ATTEMPT AT JUST USING THE PUG LEXER
// SUPERSEEDED BY ./pug-parser.js
/* eslint-disable class-methods-use-this, no-empty-function */
import { Tokenizer as HTMLTokenizer } from "../html/tokenizer"
import type { Token, VText, OffsetRange } from "../ast"
import type {
    Token as PugToken,
    TagToken as PugTagToken,
    Loc as PugLoc,
} from "pug-lexer"
import { Lexer as PugLexer } from "pug-lexer"
// const pugLex = require("pug-lexer") //eslint-disable-line no-restricted-globals

/**
 *
 */
export class Tokenizer extends HTMLTokenizer {
    private pugLexer: any
    private bufferedHTMLTokens: Token[]
    private lineToOffset: number[]
    // private lastToken: any
    private openTagStack: [PugTagToken?]
    private currentTag: PugTagToken | null

    /**
     * Initialize this tokenizer.
     * @param text The source code to tokenize.
     */
    public constructor(originalToken: VText, code: string) {
        super(code)
        this.pugLexer = new PugLexer(originalToken.value, {
            filename: "",
            startingLine: originalToken.loc.start.line,
            startingColumn: originalToken.loc.start.column,
        })
        this.bufferedHTMLTokens = []
        this.lineToOffset = []
        this.openTagStack = []
        this.currentTag = null
        let lastOffset = 0
        for (const line of code.split("\n")) {
            this.lineToOffset.push(lastOffset)
            lastOffset += line.length + 1 // add \n again
        }
        console.log(this.lineToOffset)
        // console.log(JSON.stringify(this.pugLexer.getTokens(), null, 2))
    }

    /**
     * Get the next token.
     * @returns The next token or null.
     */
    public nextToken(): Token | null {
        if (this.bufferedHTMLTokens.length > 0) {
            return this.bufferedHTMLTokens.shift() as Token
        }
        if (this.pugLexer.ended) {
            return null
        }
        this.pugLexer.advance()
        const token = this.pugLexer.tokens[this.pugLexer.tokens.length - 1]
        console.log("PUG TOKEN", token)
        this.bufferedHTMLTokens = this.convertPugTokenToHTMLTokens(token)
        return this.bufferedHTMLTokens.shift() as Token
    }

    private convertPugTokenToHTMLTokens(token: PugToken): Token[] {
        const htmlTokens: Token[] = []

        const finishCurrentTag = () => {
            if (!this.currentTag) {
                return
            }
            htmlTokens.push(
                this.createTokenFromPugToken(token, "HTMLTagClose", "", {
                    start: token.loc.start,
                    end: token.loc.start,
                }),
            )
            this.currentTag = null
        }

        const endLastTag = () => {
            finishCurrentTag()
            if (this.openTagStack.length === 0) {
                return
            }
            const lastTag = this.openTagStack.pop()!
            // TODO handle self closing tags
            htmlTokens.push(
                this.createTokenFromPugToken(
                    token,
                    "HTMLEndTagOpen",
                    lastTag.val,
                    {
                        start: token.loc.start,
                        end: token.loc.start,
                    },
                ),
            )
            htmlTokens.push(
                this.createTokenFromPugToken(token, "HTMLTagClose", "", {
                    start: token.loc.start,
                    end: token.loc.start,
                }),
            )
        }

        switch (token.type) {
            case "tag":
                finishCurrentTag()
                htmlTokens.push(
                    this.createTokenFromPugToken(
                        token,
                        "HTMLTagOpen",
                        token.val,
                    ),
                )
                this.currentTag = token
                this.openTagStack.push(token)
                break
            case ":":
                finishCurrentTag()
                break
            case "newline":
                htmlTokens.push(
                    this.createTokenFromPugToken(token, "HTMLWhitespace", "\n"),
                )
                break
            default:
                htmlTokens.push(
                    this.createTokenFromPugToken(
                        token,
                        "HTMLBogusComment",
                        (token as any).val,
                    ),
                )
                break
        }

        return htmlTokens
    }

    private createTokenFromPugToken(
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

    // /**
    //  * Get the next token.
    //  * @returns The next token or null.
    //  */
    // private convertPugTokensToHtmlTokens(): any {
    //     try {
    //         console.log(JSON.stringify(this.pugTokens, null, 2))
    //         for (const pt of this.pugTokens) {
    //             (this as any)[pt.type](pt)
    //             if (this.convertedPugTokens.length > 0) {
    //                 this.lastToken = this.convertedPugTokens[this.convertedPugTokens.length - 1]
    //             }
    //         }
    //     }
    //     catch (e) {
    //         console.error(e)
    //     }
    // }

    // /** */
    // protected indent() : any {
    // }
    // /** */
    // protected outdent() : any {
    // }

    // /** */
    // protected newline(pt: any) : any {
    //     this.closeLastOpenedTag()
    //     this.convertedPugTokens.push({
    //         type: "HTMLWhitespace",
    //         range: [
    //             pt.range[0] - 1,
    //             pt.range[1],
    //         ],
    //         loc: {
    //             start: this.lastToken.loc.end,
    //             end: {
    //                 line: pt.loc.end.line,
    //                 column: pt.loc.end.column - 1,
    //             },
    //         },
    //         value: "\n",
    //     })
    // }

    // /** */
    // protected tag(pt: any) : any {
    //     this.closeLastOpenedTag()
    //     this.convertedPugTokens.push({
    //         type: "HTMLTagOpen",
    //         range: [
    //             pt.range[0] - 1,
    //             pt.range[1],
    //         ],
    //         loc: pt.loc,
    //         value: pt.val,
    //     })
    //     this.lastOpenedTag = pt
    // }
    // /** */
    // protected closeLastOpenedTag() : any {
    //     if (!this.lastOpenedTag) {
    //         return
    //     }
    //     const pt = this.lastOpenedTag
    //     this.convertedPugTokens.push({
    //         type: "HTMLTagClose",
    //         range: [pt.range[1], pt.range[1]],
    //         loc: {
    //             start: pt.loc.end,
    //             end: pt.loc.end,
    //         },
    //         value: "",
    //     })
    //     this.convertedPugTokens.push({
    //         type: "HTMLEndTagOpen",
    //         range: [pt.range[1], pt.range[1]],
    //         loc: {
    //             start: pt.loc.end,
    //             end: pt.loc.end,
    //         },
    //         value: pt.val,
    //     })
    //     this.convertedPugTokens.push({
    //         type: "HTMLTagClose",
    //         range: [pt.range[1], pt.range[1]],
    //         loc: {
    //             start: pt.loc.end,
    //             end: pt.loc.end,
    //         },
    //         value: pt.val,
    //     })
    //     this.lastOpenedTag = null
    // }
    // /** */
    // protected "start-attributes"() : any {

    // }
    // /** */
    // protected "end-attributes"() : any {
    //     this.closeLastOpenedTag()
    // }
    // /** */
    // protected attribute(pt: any) : any {
    //     this.convertedPugTokens.push({
    //         type: "HTMLIdentifier",
    //         range: pt.range,
    //         loc: pt.loc,
    //         value: pt.name,
    //     })
    // }
    // /** */
    // protected eos() : any {
    //     this.closeLastOpenedTag()
    // }
}
/* eslint-enable class-methods-use-this, no-empty-function */
