import "@logseq/libs"
import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user"
import abcjs from "abcjs"
import crypto from "crypto"
import { v4 as uuid } from "uuid"
import { SVGChessboardOptions } from "./Chess"
import { SVGChessboard } from "./Chess"

interface ParsedChessCode {
  fen: string
  annotations: Array<Highlight | ArrowAnnotation>
  orientation: "white" | "black"
}

interface Highlight {
  type: "highlight"
  square: string
}

interface ArrowAnnotation {
  type: "arrow"
  start: string
  end: string
}

function parseCode(input: string): ParsedChessCode {
  const lines = input.split(/\r?\n/)
  let fen = lines[0]
  if (fen.startsWith("fen: ")) {
    fen = fen.replace("fen: ", "")
  }
  const annotations: Array<Highlight | ArrowAnnotation> = []
  let orientation: "white" | "black" = "white"
  for (let line of lines.splice(1)) {
    if (line.trim() === "") {
      continue
    }
    if (line.startsWith("orientation: ")) {
      line = line.replace("orientation: ", "")
      line.trim()
      if (line !== "white" && line !== "black") {
        throw Error(`Unknown orientation ${orientation}`)
      }
      orientation = line
    }
    if (line.startsWith("annotations: ")) {
      line = line.replace("annotations: ", "")
      let partial_annotations = line.split(" ")
      for (let annotation of partial_annotations) {
        if (annotation[0] === "H") {
          annotations.push({
            type: "highlight",
            square: annotation.substr(1),
          })
          continue
        }
        if (annotation[0] === "A") {
          let [start, end] = annotation.substr(1).split("-")
          annotations.push({
            type: "arrow",
            start,
            end,
          })
          continue
        }
      }
    }
  }
  return { fen, annotations, orientation }
}

/**
 * This is a data class that contains your plugin configurations. You can edit it
 * as you wish by adding fields and all the data you need.
 */
interface ObsidianChessSettings extends SVGChessboardOptions {
  whiteSquareColor: string
  blackSquareColor: string
}

async function main() {
  logseq.App.onMacroRendererSlotted(async (event) => {
    try {
      const { slot, payload } = event
      const [type] = payload.arguments

      // only handle music notation renderers
      if (!type.startsWith(":chess ")) return
      const renderBlockId = payload.uuid
      const renderBlock = await logseq.Editor.getBlock(renderBlockId)

      const [fen, orientation = "white", annotations = ""] = type
        .replace(":chess ", "")
        .split("@")

      if (orientation !== "white" && orientation !== "black") return

      const chessboard = SVGChessboard.fromFEN(fen, {
        orientation,
      })

      if (annotations.length) {
        for (let annotation of annotations.split(" ")) {
          if (annotation.includes("-")) {
            const [start, end] = annotation.split("-")
            chessboard.addArrow(start, end)
          } else {
            chessboard.highlight(annotation)
          }
        }
      }

      const xmlns = "http://www.w3.org/2000/svg"
      var boxWidth = 320
      var boxHeight = 320
      var block = document.createElementNS(xmlns, "svg")
      block.setAttributeNS(null, "viewBox", "0 0 " + boxWidth + " " + boxHeight)
      block.setAttributeNS(null, "width", String(boxWidth))
      block.setAttributeNS(null, "height", String(boxHeight))
      block.appendChild(chessboard.draw())
      block.style.display = "block"

      console.log({ block })
      const hash = crypto
        .createHash("md5")
        .update(fen || "")
        .digest("hex")
      logseq.provideUI({
        key: `chess-${hash}`,
        slot,
        reset: true,
        template: block.outerHTML,
      })

      // tell the renderer block to update, even though we aren't
      // changing the contents. This causes it to rerender.
      const rendererContent = renderBlock?.content
      await logseq.Editor.updateBlock(renderBlockId, rendererContent)
    } catch (err) {
      console.error(`Music notation rendering failed`, err)
    }
  })
}

// bootstrap
logseq.ready(main).catch(console.error)
