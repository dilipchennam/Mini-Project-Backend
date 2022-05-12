const express = require('express');
const cors = require('cors')
const uuid = require('uuid')
const QRCode = require('qrcode')

const mongoose = require('mongoose');

const app = express();

mongoose.connect('mongodb://localhost:27017/ticketing');

const stationSchema = new mongoose.Schema(
    {
        station_id: {
            type: Number,
            required: true,
            unique: true
        },
        station_code: {
            type: String,
            required: true,
            unique: true
        },
        station_name: {
            type: String,
            required: true
        }
    }
)

const ticketSchema = new mongoose.Schema(
    {
        ticket_id: {
            type: String,
            required: true,
            unique: true
        },
        from: {
            ref: 'Station',
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        to: {
            ref: 'Station',
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        fare: {
            type: Number,
            required: true
        }
    }
)

const Ticket = mongoose.model('Ticket', ticketSchema)
const Station = mongoose.model('Station', stationSchema)

app.use(express.static('qrcodes'))
app.use('/qrcodes', express.static('qrcodes'))
app.use(express.json());
app.use(cors())

app.post('/route', (req, res) => {
    const { station_id, station_name, station_code } = req.body;
    const ticket = new Station({
        station_id,
        station_code,
        station_name
    })
    ticket.save()
        .then(() => {
            res.status(201).send(ticket)
        })
        .catch(err => {
            res.send(err)
        })
})

app.get('/fareDetails', async (req, res) => {
    const { from, to } = req.body;
    const fromStationData = await Station.findOne({ station_code: from })
    const toStationData = await Station.findOne({ station_code: to })
    const fare = Math.abs(fromStationData.station_id - toStationData.station_id) * 10
    res.status(200).send({fromStationData, toStationData, fare})
})

app.post('/generateTicket', async (req, res) => {
    const { from, to } = req.body;
    if(from === to) return res.status(400).send({
        message: 'From and To cannot be same',
        err_code: 400
    })
    try {
        const fromStationData = await Station.findOne({ station_code: from }).populate('station_id')
        const toStationData = await Station.findOne({ station_code: to }).populate('station_id')
        const fare = Math.abs(fromStationData.station_id - toStationData.station_id) * 10
        const ticket = new Ticket({
            ticket_id: uuid.v4(),
            from: fromStationData,
            to: toStationData,
            fare
        })
        ticket.save()
        QRCode.toFile(`./qrcodes/${ticket.ticket_id}.png`, ticket.ticket_id, (err) => {
            res.status(500).send(err)
        })
        const ticketRes = {ticket, qr: `http://localhost:3000/qrcodes/${ticket.ticket_id}.png`}
        res.status(201).send(ticketRes)
    } catch(err) {
        res.send(err)
    }
})

app.listen(3000, () => {
    console.log('Server is running on port 3000');
})