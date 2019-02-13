// eslint-disable-next-line
class palette {
  hsv2rgb (hue, saturation, value) {
    hue /= 60
    let chroma = value * saturation
    let x = chroma * (1 - Math.abs((hue % 2) - 1))
    let rgb = hue <= 1 ? [chroma, x, 0]
      : hue <= 2 ? [x, chroma, 0]
      : hue <= 3 ? [0, chroma, x]
      : hue <= 4 ? [0, x, chroma]
      : hue <= 5 ? [x, 0, chroma] : [chroma, 0, x]

    return rgb.map(v => (v + value - chroma) * 255)
  }

  rgbToHex (r, g, b) {
    return ((r << 16) | (g << 8) | b).toString(16)
  }

  rgbToHsl (r, g, b) {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = (max + min) / 2
    let s = (max + min) / 2
    let l = (max + min) / 2

    if (max === min) {
      h = s = 0 // achromatic
    } else {
      var d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }

      h /= 6
    }

    return [parseInt(h * 360, 10), s * 100, parseInt(l * 100, 10)]
  }

  draw (picked) {
    const c = document.getElementById('palette_canvas')
    const ctx = c.getContext('2d')
    const tile = {
      width: c.width / 18,
      height: c.height / 5
    }

    // eslint-disable-next-line
    blocks.forEach((lumRow, h) => {
      lumRow.forEach((value, l) => {
        const x = (h * c.width / 18) + (tile.width / 2)
        const y = (c.height - (l + 1) * (c.height / 5)) + (tile.height / 2)
        // eslint-disable-next-line
        const radiusMod = (value / maxBlocks * 0.9) + 0.1
        const rw = tile.width / 2 * radiusMod
        const rh = tile.height / 2 * radiusMod
        ctx.fillStyle = `hsla(${h * 20}, 100%, ${(l * 20) + 10}%, 0.1)`
        ctx.fillRect(x - (tile.width / 2), y - (tile.height / 2), tile.width, tile.height)

        ctx.fillStyle = `hsl(${h * 20}, 100%, ${(l * 20) + 10}%)`
        ctx.strokeStyle = `hsl(${h * 20}, 33%, ${(l * 20) + 10}%)`
        ctx.lineWidth = 2
        ctx.save()
        ctx.beginPath()
        ctx.translate(x - rw, y - rh)
        ctx.scale(rw, rh)
        ctx.arc(1, 1, 1, 0, 2 * Math.PI, false)
        ctx.restore()
        ctx.fill()
        ctx.stroke()
      })
    })

    document.getElementById('palette_canvas').addEventListener('mousemove', (evt) => {
      const pc = document.getElementById('palette_canvas')
      const pctx = c.getContext('2d')
      const tile = {
        width: pc.width / 18,
        height: pc.height / 5
      }
      const x = parseInt(evt.offsetX / pc.offsetWidth * 18) * (pc.width / 18) + (tile.width / 2)
      const y = parseInt(evt.offsetY / pc.offsetHeight * 5) * (pc.height / 5) + (tile.height / 2)
      const p = pctx.getImageData(x, y, 1, 1).data
      const h = '#' + ('000000' + this.rgbToHex(p[0], p[1], p[2])).slice(-6)
      const hsl = this.rgbToHsl(p[0], p[1], p[2])
      document.getElementById('colour').style.backgroundColor = h
      document.getElementById('rgb').value = h
      document.getElementById('hsl').value = `${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%`
    })

    document.getElementById('palette_canvas').addEventListener('click', (evt) => {
      const pc = document.getElementById('palette_canvas')
      const pctx = c.getContext('2d')
      const tile = {
        width: pc.width / 18,
        height: pc.height / 5
      }
      const x = parseInt(evt.offsetX / pc.offsetWidth * 18) * (pc.width / 18) + (tile.width / 2)
      const y = parseInt(evt.offsetY / pc.offsetHeight * 5) * (pc.height / 5) + (tile.height / 2)
      const p = pctx.getImageData(x, y, 1, 1).data
      const hsl = this.rgbToHsl(p[0], p[1], p[2])
      window.open(`/explore-o-matic/colour/${hsl[0]},${hsl[1]},${hsl[2]}`, '_blank')
    })

    document.getElementById('colour').addEventListener('mouseleave', (evt) => {
      document.getElementById('colour').style.backgroundColor = 'white'
    })
  }
}
