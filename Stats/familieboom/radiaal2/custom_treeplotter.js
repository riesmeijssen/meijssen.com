// var data = []
// var nodes = [
//     { id: 6, pids: [8], name: "Clemens", gender: "male", birthyear: 1964, angle: 0},
//     { id: 8, pids: [6], name: "Atty", gender: "female" , birthyear: 1974, angle: 90},
//         { id: 9, mid: 8, fid: 6, name: "Ries", gender: "male", birthyear: 1998, angle: 40},
//         { id: 10, mid: 8, fid: 6, name: "Vosse", gender: "male", birthyear: 1998, angle: 50},
//         { id: 11, mid: 8, fid: 6, name: "Stijn", gender: "male", birthyear: 2000, angle: 60},
//         { id: 12, mid: 8, fid: 6, name: "Arend", gender: "male", birthyear: 2002, angle: 70}
// ]

// var newestyear = 2022
// var oldestyear = 1899
// for (let i=0; i<nodes.lenth; i++) {
//     persoon = nodes[i]
//     if ("mid" in persoon && "fid" in persoon) {
        
//     }
//     data.push()
// }


var data = [
    {
        type: "scatterpolar",
        mode: "lines+markers",
        r: [1940,1952,1953,1940,1955],
        theta: [45,135,70,120,90],
        line: {
            color: "#ff66ab"
        },
        marker: {
            color: "#8090c7",
            symbol: "square",
            size: 8
        },
        subplot: "polar "
    },
    {
        type: "scatterpolar",
        mode: "lines+markers",
        r: [1900, 1910, 1935, 1930, 1940],
        theta: [225,270,315,300,240],
        line: {
            color: "#ff66ab"
        },
        marker: {
            color: "#8090c7",
            symbol: "square",
            size: 8
        },
        subplot: "polar2"
    }
]

var layout = {
    showlegend: false,
    polar: {
        sector: [30, 150],
        domain: {
            x: [0,1],
            y: [0.5,1]
        },
        
        radialaxis: {
            tickfont: {
                size: 8
            },
            // range: [oldestyear, newestyear]
        },
        angularaxis: {
            // showgrid: false,
            // showticklables: false,
            tickfont: {
                size: 1
            }
        }
    },
    polar2: {
        domain: {
            x: [0,1],
            y: [0,0.5]
        },
        sector: [210, 330],
        radialaxis: {
            tickfont: {
                size: 8
            },
            // range: [oldestyear, newestyear]
        },
        angularaxis: {
            // showgrid: false,
            // showticklables: false,
            tickfont: {
                size: 1
            }
        }
    }
}

Plotly.newPlot('tester', data, layout)