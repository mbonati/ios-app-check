const Table = require('tty-table')

const tableHeader = [
    {
        value: "Frameowrk/Dynamic Library",
        formatter: function (value) {
            return this.style(value, "cyan")
        },
        width: 30
    },
    {
        value: "i386",
        width: 10
    },
    {
        value: "x86_64",
        width: 10
    },
    {
        value: "armv7",
        width: 10
    },
    {
        value: "armv7s",
        width: 10
    },
    {
        value: "arm64",
        width: 10
    },
]

const t3 = Table(header, [], {});
t3.push(
    ["pound cake", '*', '', '', '', '']
)
const str3 = t3.render()
console.log(str3)