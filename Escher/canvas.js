window.addEventListener('load', () => {
    // Settings
    const settings = {
        symmetry: undefined,
        draw_settings: {
            line_width: 3,
            primary_color: undefined,
            secondary_color: undefined
        },
        background_settings: {
            line_width: 1,
            color: "grey",
        },
        global_rotation: undefined,
        center_coordinate: {
            x: undefined,
            y: undefined,
        },
        d_x: {
            length: undefined,
            x: undefined,
            y: undefined,
        },
        d_y: {
            length: undefined,
            x: undefined,
            y: undefined
        },
        x_rep: {
            x: undefined,
            y: undefined
        },
        y_rep: {
            x: undefined,
            y: undefined
        },
        xy_angle: undefined,
    }
    finishSettings(settings)

    // Create variables
    const canvas = document.querySelector("#canvas")
    canvas.width = window.innerWidth - 3
    canvas.height = window.innerHeight - 3
    const ctx = canvas.getContext("2d")
    painting = false
    last = {
        x: undefined,
        y: undefined,
    }
    client = {
        x: undefined,
        y: undefined,
    }
    mouse_button = undefined


    // Setup
    setup(ctx, settings)

    function startPositionMouse(e) {
        mouse_button = e.button
        painting = true
        last.x = e.clientX
        last.y = e.clientY
        drawMouse(e)
    }

    function finishedPositionMouse() {
        painting = false
    }

    function drawMouse(e) {
        // Draw a new part of a line
        if (!painting) return 

        client.x = e.clientX
        client.y = e.clientY

        draw()
    }

    function startPositionTouch(e) {
        mouse_button = 0
        painting = true
        last.x = e.touches[0].clientX
        last.y = e.touches[0].clientY
        drawTouch(e)
    }

    function finishedPositionTouch() {
        painting = false
    }

    function drawTouch(e) {
        // Draw a new part of a line
        if (!painting) return 

        client.x = e.touches[0].clientX
        client.y = e.touches[0].clientY

        draw()
    }

    function draw() {
        ctx.lineWidth = settings.draw_settings.line_width;
        ctx.lineCap = "round"
        switch (mouse_button) {
            case 0:
                // Left mouse button pressed
                ctx.strokeStyle = settings.draw_settings.primary_color
                break
            case 2:
                // Right mouse button pressed (2 == middle mouse button)
                ctx.strokeStyle = settings.draw_settings.secondary_color
                break
        }
        if (settings.symmetry == "p1") {
            multipleTranslationsP1(client, last, settings, ctx)
        } else if (settings.symmetry == "p2") {
            multipleTranslationsP2(client, last, settings, ctx)
        } else if (settings.symmetry == "p3") {
            multipleTranslationsP3(client, last, settings, ctx) 
        } else if (settings.symmetry == "p31m") {
            multipleTranslationsP31M(client, last, settings, ctx) 
        } else if (settings.symmetry == "p4") {
            multipleTranslationsP4(client, last, settings, ctx)
        } else if (settings.symmetry == "pg") {
            multipleTranslationsPG(client, last, settings, ctx)
        } else if (settings.symmetry == "pm") {
            multipleTranslationsPM(client, last, settings, ctx)
        }
    }

    function resetDrawing() {
        // Remove all drawing and create base rectangle
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setup(ctx, settings)
    }

    function updateSettings() {
        finishSettings(settings)
        setAllSliders(settings)
        setAllLabels(settings)
        resetDrawing()
    }

    function updateDrawingSize() {
        settings.draw_settings.line_width = drawing_size_slider.value
        setAllLabels(settings)
    }

    function scrollDrawingSize(e) {
        settings.draw_settings.line_width = Math.min(
            Math.max(settings.draw_settings.line_width + Math.sign(e.deltaY), 1), 60
        )

        console.log(settings.draw_settings.line_width)
        console.log(typeof settings.draw_settings.line_width)
        setAllSliders(settings)
        setAllLabels(settings)
    }

    function changeAsideVisibility() {
        aside_element.style.visibility = view_aside_button.checked ? "visible" : "hidden"
    }

    function updateColors() {
        settings.draw_settings.primary_color = primary_color_input.value
        settings.draw_settings.secondary_color = secondary_color_input.value
    }

    function keyPress(e) {
        console.log(e.code)
        if (e.code == "KeyR") {
            resetDrawing()
        } else if (e.code == "Space") {
            view_aside_button.checked = !view_aside_button.checked
            changeAsideVisibility()
        }
    }

    view_aside_button.addEventListener('input', changeAsideVisibility)
    canvas.addEventListener("mousedown", startPositionMouse)
    canvas.addEventListener("mouseup", finishedPositionMouse)
    canvas.addEventListener("mousemove", drawMouse)

    // Touch events for mobile support
    canvas.addEventListener("touchstart", startPositionTouch)
    canvas.addEventListener("touchend", finishedPositionTouch)
    canvas.addEventListener("touchmove", drawTouch)

    // Prevent right click context menu
    canvas.addEventListener("touchcancel", finishedPositionTouch)
    canvas.addEventListener("touchleave", finishedPositionTouch)

    // Make the canvas not scrollable
    canvas.addEventListener("touchmove", event => {
        event.preventDefault()
    })

    canvas.addEventListener("wheel", scrollDrawingSize)
    canvas.addEventListener("contextmenu", event => event.preventDefault())
    reset_button.addEventListener("click", resetDrawing)

    global_rotation_slider.addEventListener("input", updateSettings)
    xy_angle_slider.addEventListener("input", updateSettings)
    x_length_slider.addEventListener("input", updateSettings)
    y_length_slider.addEventListener("input", updateSettings)
    drawing_size_slider.addEventListener("input", updateDrawingSize)
    symmetry_select.addEventListener("change", updateSettings)
    primary_color_input.addEventListener("input", updateColors)
    secondary_color_input.addEventListener("input", updateColors)

    window.addEventListener("keyup", keyPress)

    // TODO Move these
    setAllSliders(settings)
    setAllLabels(settings)
    changeAsideVisibility()
})


function setup(ctx, set) {
    ctx.lineWidth = set.background_settings.line_width
    ctx.strokeStyle = set.background_settings.color
    const x = set.center_coordinate.x
    const y = set.center_coordinate.y
    if (triangles.includes(set.symmetry)) {
        // Draw 1 base triangle
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + set.d_x.x, y + set.d_x.y)
        ctx.lineTo(x + set.d_y.x, y + set.d_y.y)
        ctx.lineTo(x, y)
        ctx.stroke()
    } else {
        // Draw 1 base parallellogram
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + set.d_x.x, y + set.d_x.y)
        ctx.lineTo(x + set.d_x.x + set.d_y.x, y + set.d_x.y + set.d_y.y)
        ctx.lineTo(x + set.d_y.x, y + set.d_y.y)
        ctx.lineTo(x, y)
        ctx.stroke()
    }

    if (true) {
        ctx.beginPath()
        ctx.arc(set.center_coordinate.x, set.center_coordinate.y, 4, 0, 2 * Math.PI)
        ctx.stroke()
        function canvas_arrow(context, fromx, fromy, tox, toy) {
            var headlen = 10; // length of head in pixels
            var dx = tox - fromx;
            var dy = toy - fromy;
            var angle = Math.atan2(dy, dx);
            context.moveTo(fromx, fromy);
            context.lineTo(tox, toy);
            context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
            context.moveTo(tox, toy);
            context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
        }
        ctx.beginPath()
        canvas_arrow(
            ctx,
            set.center_coordinate.x,
            set.center_coordinate.y,
            set.center_coordinate.x + set.d_x.x,
            set.center_coordinate.y + set.d_x.y,
        )
        canvas_arrow(
            ctx,
            set.center_coordinate.x + set.d_y.x,
            set.center_coordinate.y + set.d_y.y,
            set.center_coordinate.x,
            set.center_coordinate.y,
        )
        ctx.stroke()
    }
    return
}

function d2r(angle) {
    // Degree to radians
    return angle / 180 * Math.PI
}

function finishSettings(settings) {
    // Fill in all settings which are not set in stone
    settings.symmetry = symmetry_select.value
    console.log(`symmetry: ${settings.symmetry}`)

    settings.global_rotation = global_rotation_slider.value
    settings.d_x.length = x_length_slider.value

    // Set angles and lengths
    if ((settings.symmetry == "p1") || (settings.symmetry == "p2") || (settings.symmetry == "pg")) {
        settings.xy_angle = xy_angle_slider.value
        settings.d_y.length = y_length_slider.value
    } else if (settings.symmetry == "p3") {
        settings.xy_angle = 120
        settings.d_y.length = settings.d_x.length
    } else if (settings.symmetry == "p31m") {
        settings.xy_angle = 60
        settings.d_y.length = settings.d_x.length
    } else if (settings.symmetry == "p4") {
        settings.xy_angle = 90
        settings.d_y.length = settings.d_x.length
    } else if ((settings.symmetry == "pm")) {
        settings.xy_angle = 90
        settings.d_y.length = y_length_slider.value
    }

    settings.draw_settings.primary_color = primary_color_input.value
    settings.draw_settings.secondary_color = secondary_color_input.value

    const a_x = d2r(settings.global_rotation)
    const a_y = d2r(settings.xy_angle) + a_x
    settings.d_x.x = settings.d_x.length * Math.cos(a_x)
    settings.d_x.y = settings.d_x.length * Math.sin(a_x)
    settings.d_y.x = settings.d_y.length * Math.cos(a_y)
    settings.d_y.y = settings.d_y.length * Math.sin(a_y)

    // Set repetition vectors
    switch (settings.symmetry) {
        case "p1":
            settings.x_rep = settings.d_x
            settings.y_rep = settings.d_y
            break
        case "p2":
        case "pm":
            settings.x_rep = multiply(settings.d_x, 2)
            settings.y_rep = settings.d_y
            break
        case "p4":
            settings.x_rep = multiply(settings.d_x, 2)
            settings.y_rep = multiply(settings.d_y, 2)
            break
        case "p3":
            settings.x_rep = sub_vec(settings.d_x, settings.d_y)
            settings.y_rep = add_vec(multiply(settings.d_x, 2), settings.d_y)
            break
        case "p3m":
            settings.x_rep = sub_vec(settings.d_x, multiply(settings.d_y, 2))
            settings.y_rep = sub_vec(multiply(settings.d_x, 2), settings.d_y)
            break
        case "pg":
            console.log("angle, d_x, rotated_d_x, x_rep, y_rep")
            console.log(settings.xy_angle)
            console.log(settings.d_x)
            const rotated_d_x = rotate_vec(settings.d_x, 2 * settings.xy_angle - 180)
            console.log(rotated_d_x)
            settings.x_rep = add_vec(settings.d_x, rotated_d_x)
            settings.y_rep = settings.d_y
            console.log(settings.x_rep)
            console.log(settings.y_rep)
            break
    }

    if (triangles.includes(settings.symmetry)) {
        settings.center_coordinate.x = Math.round(window.innerWidth / 2) - 0.25 * (settings.d_x.x + settings.d_y.x)
        settings.center_coordinate.y = Math.round(window.innerHeight / 2) - 0.25 * (settings.d_x.y + settings.d_y.y)
    } else {
        settings.center_coordinate.x = Math.round(window.innerWidth / 2) - 0.5 * (settings.d_x.x + settings.d_y.x)
        settings.center_coordinate.y = Math.round(window.innerHeight / 2) - 0.5 * (settings.d_x.y + settings.d_y.y)
    }
}
