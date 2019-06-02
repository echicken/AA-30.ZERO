const EventEmitter = require('events').EventEmitter;
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

function parse_frx(line) {
    const data = line.split(',').map(parseFloat);
    const F = data[0];
    const R = data[1];
    const X = data[2];
    const XX = X * X;
    const Rm = (R - 50) * (R - 50);
    const Rp = (R + 50) * (R + 50);
    const N = Math.sqrt(Rm + XX);
    const D = Math.sqrt(Rp + XX);
    const G = N / D;
    let vswr = (1 + G) / (1 - G);
    if (vswr < 0 || vswr > 99) vswr = 99;
    return { frequency: F, vswr };
}

class AA30Zero extends EventEmitter {

    constructor (port) {
        super();
        this._queue = []; // { cmd, expect }
        this._handle = new SerialPort(port, { baudRate: 38400 });
        this._discard = false;
    }

    _write(cmd, expect = /^OK$/, callback = null) {
        this._queue.push({ cmd, expect, callback });
        if (this._queue.length == 1) this._handle.write(cmd + '\r\n');
    }

    version() {
        return new Promise(res => {
            this._write('ver', /^AA-30 ZERO \d+$/, data => res(data));
        });
    }

    scan(centre, range, samples) {
        this._write(`fq${centre}`);
        this._write(`sw${range}`);
        return new Promise(res => {
            let frequency = 0;
            let vswr = 100;
            this.on('measurement', data => {
                if (data.vswr > vswr) return;
                frequency = data.frequency;
                vswr = data.vswr;
            });
            this._write(`frx${samples}`, /^OK$/, () => res({frequency, vswr}));
        });
    }

    park(frequency) {
        this._discard = true;
        return this._scan(frequency, 1, 1);
    }

    init() {
        const parser = this._handle.pipe(new Readline({ delimiter: '\r\n' }));
        parser.on('data', data => {
            if (this._queue.length && data.search(this._queue[0].expect) > -1) {
                const cmd = this._queue.shift();
                if (cmd.callback !== null) cmd.callback(data);
                if (this._queue.length) {
                    this._handle.write(this._queue[0].cmd + '\r\n');
                }
            } else if (data.search(/^.*,.*,.*$/) > -1) {
                if (this._discard) {
                    this._discard = false;
                } else {
                    this.emit('measurement', parse_frx(data));
                }
            }
        });
    }

}

module.exports = AA30Zero;
