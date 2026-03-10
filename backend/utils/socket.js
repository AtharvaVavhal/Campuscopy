const emitToJob = (io, jobId, event, data) => {
  io.to(`job:${jobId}`).emit(event, data);
};

const emitToPrinter = (io, printerId, event, data) => {
  io.to(`printer:${printerId}`).emit(event, data);
};

const emitJobStatus = (io, job) => {
  emitToJob(io, job.id, 'job_status', {
    jobId: job.id,
    status: job.status,
    updatedAt: job.updated_at,
  });

  if (job.printer_id) {
    emitToPrinter(io, job.printer_id, 'job_updated', {
      jobId: job.id,
      status: job.status,
      updatedAt: job.updated_at,
    });
  }
};

module.exports = { emitToJob, emitToPrinter, emitJobStatus };
