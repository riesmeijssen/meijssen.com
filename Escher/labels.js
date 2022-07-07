const global_rotation_slider = document.getElementById("global-rotation")
const global_rotation_label = document.getElementById("global-rotation-label")

const xy_angle_slider = document.getElementById("xy-angle")
const xy_angle_label = document.getElementById("xy-angle-label")

const x_length_slider = document.getElementById("x-length")
const x_length_label = document.getElementById("x-length-label")

const y_length_slider = document.getElementById("y-length")
const y_length_label = document.getElementById("y-length-label")

const drawing_size_slider = document.getElementById("drawing-size")
const drawing_size_label = document.getElementById("drawing-size-label")

const primary_color_input = document.getElementById("primary-color")
const secondary_color_input = document.getElementById("secondary-color")

const view_aside_button = document.getElementById("myInput")

const aside_element = document.getElementsByClassName("aside-class")[0]

const reset_button = document.getElementById("reset-button")

const symmetry_select = document.getElementById("symmetry-select")

const triangles = ["p31m"]


function setAllLabels(settings) {
    global_rotation_label.innerHTML = `Global Rotation: ${global_rotation_slider.value}`
    xy_angle_label.innerHTML = `XY Angle: ${xy_angle_slider.value}`
    x_length_label.innerHTML = `X length: ${x_length_slider.value}`
    y_length_label.innerHTML = `Y length: ${y_length_slider.value}`
    drawing_size_label.innerHTML = `Pen Size: ${drawing_size_slider.value}`
    if ((settings.symmetry == "p1") || (settings.symmetry == "p2") || (settings.symmetry == "pg")) {
        xy_angle_slider.disabled = false
        y_length_slider.disabled = false
    } else if ((settings.symmetry == "p4") || (settings.symmetry == "p3") || (settings.symmetry == "p31m")) {
        xy_angle_slider.disabled = true
        y_length_slider.disabled = true
    } else if ((settings.symmetry == "pm")) {
        xy_angle_slider.disabled = true
        y_length_slider.disabled = false
    }
}

function setAllSliders(settings) {
    global_rotation_slider.value = settings.global_rotation
    xy_angle_slider.value = settings.xy_angle
    x_length_slider.value = settings.d_x.length
    y_length_slider.value = settings.d_y.length
    drawing_size_slider.value = settings.draw_settings.line_width
}