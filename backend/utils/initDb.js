const User = require('../models/User');
const Service = require('../models/Service');
const Seat = require('../models/Seat');

async function generateNextEventId() {
  const allEvents = await Service.find({ eventId: { $exists: true, $ne: '' } });
  let maxNum = 0;
  for (const ev of allEvents) {
    if (ev.eventId) {
      const match = ev.eventId.match(/^EVENT(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `EVENT${String(nextNum).padStart(3, '0')}`;
}

async function ensureEventIdsAndSeats() {
  try {
    // 1. Ensure default admin has organization
    const defaultAdmin = await User.findOne({ email: 'admin@church.com' });
    if (defaultAdmin) {
      let adminChanged = false;
      if (!defaultAdmin.organization || defaultAdmin.organization === 'General Organization') {
        defaultAdmin.organization = 'Grace Church';
        adminChanged = true;
      }
      if (!defaultAdmin.organizationId) {
        defaultAdmin.organizationId = defaultAdmin._id.toString();
        adminChanged = true;
      }
      if (adminChanged) {
        await User.updateOne(
          { _id: defaultAdmin._id },
          { $set: { organization: defaultAdmin.organization, organizationId: defaultAdmin.organizationId } }
        );
      }
    }

    const services = await Service.find().sort({ createdAt: 1 });
    let counter = 1;
    for (const service of services) {
      const updates = {};

      // If legacy event lacks organization or createdBy, associate with default admin
      if (!service.organization && defaultAdmin) {
        updates.organization = defaultAdmin.organization;
      }
      if (!service.createdBy && defaultAdmin) {
        updates.createdBy = defaultAdmin._id;
        updates.organizationId = defaultAdmin._id.toString();
      }
      if (!service.eventId) {
        // Find next available EVENTxxx
        let candidate = `EVENT${String(counter).padStart(3, '0')}`;
        while (await Service.findOne({ eventId: candidate })) {
          counter++;
          candidate = `EVENT${String(counter).padStart(3, '0')}`;
        }
        service.eventId = candidate;
        await Service.updateOne({ _id: service._id }, { $set: { eventId: candidate } });
        counter++;
      }

      // Sync seats belonging to this service/event
      const seats = await Seat.find({ serviceId: service._id });
      for (const seat of seats) {
        const updates = {};
        if (!seat.eventId) {
          updates.eventId = service.eventId;
        }
        if (!seat.seatNo) {
          updates.seatNo = `${seat.row}${seat.number}`;
        }
        if (Object.keys(updates).length > 0) {
          await Seat.updateOne({ _id: seat._id }, { $set: updates });
        }
      }
    }
    console.log('[SeatHub Init] Checked and synced all eventIds and seatNos');
  } catch (err) {
    console.error('[SeatHub Init] Error syncing eventIds:', err);
  }
}

module.exports = {
  generateNextEventId,
  ensureEventIdsAndSeats,
};
