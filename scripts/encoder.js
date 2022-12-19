const { LED } = require('led')
const { EventEmitter } = require('events')
const { PWM } = require('pwm')
const {SPI} = require('spi')
const {GPIO} = require('gpio')

class LEDAnode extends LED {
	off() {
		super.on()
	}

	on() {
		super.off()
	}
}

class Encoder extends EventEmitter {
	constructor({ a, b }) {
		super()

		this.a = a
		this.b = b

		pinMode([a, b], INPUT_PULLUP)

		setWatch(() => {
			this.update()
		}, a, CHANGE)
	}

	update() {
		const aValue = digitalRead(this.a)
		const bValue = digitalRead(this.b)

		if(aValue === LOW) {
			if(bValue === HIGH) {
				this.emit('increment')
			} else {
				this.emit('decrement')
			}
		}
	}
}

class RangeEncoder extends Encoder {
	constructor({ value, min, max, step, ...args }) {
		super(args)

		this.value = value
		this.on('increment', () => {
			if(this.value < max) {
				this.value = Math.min(max, this.value + step)
			}

			this.emit('change', this.value)
		})

		this.on('decrement', () => {
			if(this.value > min) {
				this.value = Math.max(min, this.value - step)
			}

			this.emit('change', this.value)
		})
	}
}

class SPIDAC {
	constructor({ spi, csPin, precision }) {
		this.spi = spi
		this.csPin = csPin
		this.precision = precision
	}

	write(value, { dac = 'a', gain = 1, shutdown = false } = {}) {
		this.csPin.write(LOW)
		const dacBit = (dac === 'a') << 15
		const gainBit = (2 - gain) << 13
		const shutdownBit = (!shutdown) << 12

		const voltageBits = Math.floor(value * (2 ** this.precision)) << (12 - this.precision)

		const data = dacBit | gainBit | shutdownBit | voltageBits

		const highByte = data >> 8
		const lowByte = data & 0xff

		this.spi.transfer(new Uint8Array([ highByte, lowByte ]))
		this.csPin.write(HIGH)
	}
}

const r = new PWM(4, 1000, 1)
const g = new PWM(2, 1000, 1)
const b = new PWM(0, 1000, 1)

r.start()
b.start()
g.start()

const encoder = new RangeEncoder({ value: 0, min: 0, max: 1, step: 0.05, a: 11, b: 12 })

const dac = new SPIDAC({
	spi: new SPI(0),
	csPin: new GPIO(13),
	precision: 12
})

encoder.on('change', value => {
	r.setDuty(Math.sqrt(1 - value))
	dac.write(value)
})
