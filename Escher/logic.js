function drawPath(clientX, clientY, trans_x, trans_y, last_x, last_y, context) {
    context.beginPath()
    context.moveTo(last_x + trans_x, last_y + trans_y)
    context.lineTo(clientX + trans_x, clientY + trans_y)
    context.stroke()
}

function unit_vec(vector) {
    length = Math.sqrt(vector.x * vector.x + vector.y * vector.y)
    return {
        x: vector.x / length,
        y: vector.y / length
    }
}

function rotate_vec(vec, deg) {
    const rad = deg * Math.PI / 180
    return {
        x: vec.x * Math.cos(rad) - vec.y * Math.sin(rad),
        y: vec.x * Math.sin(rad) + vec.y * Math.cos(rad)
    }
}

function dot(vec1, vec2) {
    return vec1.x * vec2.x + vec1.y * vec2.y
}

function multiply(vec, num) {
    return {x: vec.x * num, y: vec.y * num}
}

function add_vec(vec1, vec2) {
    return {x: vec1.x + vec2.x, y: vec1.y + vec2.y}
}

function sub_vec(vec1, vec2) {
    return {x: vec1.x - vec2.x, y: vec1.y - vec2.y}
}

function createRelativeCoordinates(x, y, settings) {
    // Return coordinates relative to centerpoint
    if (settings.symmetry == "p2") {
        // [
        //     0 degrees rotated,
        //     180 deg rotated
        // ]
        const d_x = x - settings.center_coordinate.x
        const d_y = y - settings.center_coordinate.y
        return [
            {x: d_x, y: d_y},
            {x: - d_x + settings.d_y.x, y: - d_y + settings.d_y.y}
        ]
    } else if (settings.symmetry == "p3"){
        // [
        //     0 degrees rotated,
        //     120 degrees rotated,
        //     240 degrees rotated
        // ]
        const d_x = x - settings.center_coordinate.x
        const d_y = y - settings.center_coordinate.y
        return [
            {x: d_x, y: d_y},
            {x: - 1 / 2 * d_x - Math.sqrt(3) / 2 * d_y, y: - 1 / 2 * d_y + Math.sqrt(3) / 2 * d_x},
            {x: - 1 / 2 * d_x + Math.sqrt(3) / 2 * d_y, y: - 1 / 2 * d_y - Math.sqrt(3) / 2 * d_x}
        ]
    } else if (settings.symmetry == "p31m"){
        // [
        //     0 degrees rotated,
        //     60 degrees rotated and flipped,
        //     120 degrees rotated,
        //     180 degrees rotated and flipped,
        //     240 degrees rotated
        //     300 degrees rotated and flipped,
        // ]
        const d_x = x - settings.center_coordinate.x
        const d_y = y - settings.center_coordinate.y
        const u_x = unit_vec(settings.d_x)
        const projected_x = dot({x: d_x, y: d_y}, u_x)
        const height_on_x = {x: d_x - u_x.x * projected_x, y: d_y - u_x.y * projected_x}
        const mirrored = {x: d_x - 2 * height_on_x.x, y: d_y - 2 * height_on_x.y}
        return [
            {x: d_x, y: d_y},
            {x: mirrored.x, y: mirrored.y},
            {x: - 1 / 2 * d_x - Math.sqrt(3) / 2 * d_y, y: - 1 / 2 * d_y + Math.sqrt(3) / 2 * d_x},
            {x: - 1 / 2 * mirrored.x - Math.sqrt(3) / 2 * mirrored.y, y: - 1 / 2 * mirrored.y + Math.sqrt(3) / 2 * mirrored.x},
            {x: - 1 / 2 * d_x + Math.sqrt(3) / 2 * d_y, y: - 1 / 2 * d_y - Math.sqrt(3) / 2 * d_x},
            {x: - 1 / 2 * mirrored.x + Math.sqrt(3) / 2 * mirrored.y, y: - 1 / 2 * mirrored.y - Math.sqrt(3) / 2 * mirrored.x},
        ]
    } else if (settings.symmetry == "p4") {
        // [
        //     0 degrees rotated,
        //     90 degrees rotated,
        //     180 degrees rotated,
        //     270 degrees rotated
        // ]
        const d_x = x - settings.center_coordinate.x
        const d_y = y - settings.center_coordinate.y
        return [
            {x:   d_x, y:   d_y},
            {x:   d_y, y: - d_x},
            {x: - d_x, y: - d_y},
            {x: - d_y, y:   d_x},
        ]
    } else if (settings.symmetry == "pm") {
        // [
        //     normal,
        //     flipped
        // ]
        const d_x = x - settings.center_coordinate.x
        const d_y = y - settings.center_coordinate.y
        const u_x = unit_vec(settings.d_x)
        const projected_x = dot({x: d_x, y: d_y}, u_x)
        return [
            {x: d_x, y: d_y},
            {x: d_x - 2 * u_x.x * projected_x, y: d_y - 2 * u_x.y * projected_x}
        ]
    } else if (settings.symmetry == "pg") {
        // [
        //     normal,
        //     flipped (but other than pm)
        // ]
        const d_x = x - settings.center_coordinate.x
        const d_y = y - settings.center_coordinate.y
        const distance_to_x_vector = ((settings.d_x.x - 0)*(0 - d_y) - (0 - d_x)*(settings.d_x.y - 0)) / settings.d_x.length
        const u_y = unit_vec(settings.d_y)
        console.log("distance to y: ", distance_to_x_vector)
        return [
            {x: d_x, y: d_y},
            {
                // x: d_x - settings.d_x.x + settings.d_y.x - 2 * u_y.x * projected_y,
                // y: d_y - settings.d_x.y + settings.d_y.y - 2 * u_y.y * projected_y
                // x: d_x - settings.d_x.x - 2 * u_y.x * projected_y,
                // y: d_y - settings.d_x.y - 2 * u_y.y * projected_y
                // x: d_x - settings.d_x.x + 2 * distance_to_x_vector * u_y.x,
                // y: d_y - settings.d_x.y + 2 * distance_to_x_vector * u_y.y
                x: d_x - settings.d_x.x,
                y: d_y - settings.d_x.y

            }
        ]
    }
}

function multipleTranslationsP1(client, last, settings, context) {
    for (let i = -7; i < 7; i++) {
        for (let j = -7; j < 7; j++) {
            drawPath(
                client.x,
                client.y,
                settings.d_x.x * i + settings.d_y.x * j,
                settings.d_x.y * i + settings.d_y.y * j,
                last.x,
                last.y,
                context
            )
        }
    }
    last.x = client.x
    last.y = client.y
}

function multipleTranslationsP2(client, last, settings, context) {
    const r_c = createRelativeCoordinates(client.x, client.y, settings)
    const last_r_c = createRelativeCoordinates(last.x, last.y, settings)
    for (let y_rep = -7; y_rep < 7; y_rep++) {
        for (let x_rep = -7; x_rep < 7; x_rep++) {
            for (let i = 0; i < r_c.length; i++) {
                drawPath(
                    r_c[i].x,
                    r_c[i].y,
                    settings.center_coordinate.x + settings.d_x.x * 2 * x_rep + settings.d_y.x * y_rep,
                    settings.center_coordinate.y + settings.d_x.y * 2 * x_rep + settings.d_y.y * y_rep,
                    last_r_c[i].x,
                    last_r_c[i].y,
                    context
                )
            }
        }
    }
    last.x = client.x
    last.y = client.y
}

function multipleTranslationsP4(client, last, settings, context) {
    const r_c = createRelativeCoordinates(client.x, client.y, settings)
    const last_r_c = createRelativeCoordinates(last.x, last.y, settings)
    for (let y_rep = -7; y_rep < 7; y_rep++) {
        for (let x_rep = -7; x_rep < 7; x_rep++) {
            for (let i = 0; i < r_c.length; i++) {
                drawPath(
                    r_c[i].x,
                    r_c[i].y,
                    settings.center_coordinate.x + settings.d_x.x * 2 * x_rep + settings.d_y.x * 2 * y_rep,
                    settings.center_coordinate.y + settings.d_x.y * 2 * x_rep + settings.d_y.y * 2 * y_rep,
                    last_r_c[i].x,
                    last_r_c[i].y,
                    context
                )
            }
        }
    }
    last.x = client.x
    last.y = client.y
}

function multipleTranslationsPG(client, last, settings, context) {
    const r_c = createRelativeCoordinates(client.x, client.y, settings)
    const last_r_c = createRelativeCoordinates(last.x, last.y, settings)

    for (let y_rep = 0; y_rep < 1; y_rep++) {
        for (let x_rep = 0; x_rep < 1; x_rep++) {
            for (let i = 0; i < r_c.length; i++) {
                drawPath(
                    r_c[i].x,
                    r_c[i].y,
                    settings.center_coordinate.x + settings.x_rep.x * x_rep + settings.y_rep.x * y_rep,
                    settings.center_coordinate.y + settings.x_rep.y * x_rep + settings.y_rep.y * y_rep,
                    last_r_c[i].x,
                    last_r_c[i].y,
                    context
                )
            }
        }
    }

    last.x = client.x
    last.y = client.y
}

function multipleTranslationsPM(client, last, settings, context) {
    const r_c = createRelativeCoordinates(client.x, client.y, settings)
    const last_r_c = createRelativeCoordinates(last.x, last.y, settings)

    for (let y_rep = -7; y_rep < 7; y_rep++) {
        for (let x_rep = -7; x_rep < 7; x_rep++) {
            for (let i = 0; i < r_c.length; i++) {
                drawPath(
                    r_c[i].x,
                    r_c[i].y,
                    settings.center_coordinate.x + settings.d_x.x * 2 * x_rep + settings.d_y.x * y_rep,
                    settings.center_coordinate.y + settings.d_x.y * 2 * x_rep + settings.d_y.y * y_rep,
                    last_r_c[i].x,
                    last_r_c[i].y,
                    context
                )
            }
        }
    }

    last.x = client.x
    last.y = client.y
}

function multipleTranslationsP3(client, last, settings, context) {
    const r_c = createRelativeCoordinates(client.x, client.y, settings)
    const last_r_c = createRelativeCoordinates(last.x, last.y, settings)

    for (let y_rep = -7; y_rep < 7; y_rep++) {
        for (let x_rep = -7; x_rep < 7; x_rep++) {
            for (let i = 0; i < r_c.length; i++) {
                drawPath(
                    r_c[i].x,
                    r_c[i].y,
                    settings.center_coordinate.x + settings.d_x.x * x_rep - settings.d_y.x * x_rep + 2 * settings.d_x.x * y_rep + settings.d_y.x * y_rep,
                    settings.center_coordinate.y + settings.d_x.y * x_rep - settings.d_y.y * x_rep + 2 * settings.d_x.y * y_rep + settings.d_y.y * y_rep,
                    last_r_c[i].x,
                    last_r_c[i].y,
                    context
                )
            }
        }
    }

    last.x = client.x
    last.y = client.y
}

function multipleTranslationsP31M(client, last, settings, context) {
    const r_c = createRelativeCoordinates(client.x, client.y, settings)
    const last_r_c = createRelativeCoordinates(last.x, last.y, settings)

    for (let y_rep = -7; y_rep < 7; y_rep++) {
        for (let x_rep = -7; x_rep < 7; x_rep++) {
            for (let i = 0; i < r_c.length; i++) {
                drawPath(
                    r_c[i].x,
                    r_c[i].y,
                    settings.center_coordinate.x + settings.d_x.x * x_rep - 2 * settings.d_y.x * x_rep + 2 * settings.d_x.x * y_rep - settings.d_y.x * y_rep,
                    settings.center_coordinate.y + settings.d_x.y * x_rep - 2 * settings.d_y.y * x_rep + 2 * settings.d_x.y * y_rep - settings.d_y.y * y_rep,
                    last_r_c[i].x,
                    last_r_c[i].y,
                    context
                )
            }
        }
    }

    last.x = client.x
    last.y = client.y
}