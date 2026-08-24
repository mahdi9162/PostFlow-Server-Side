import { getDB } from '../../config/db';
import { DriveAutomationRun } from './driveAutomation.types';

export const saveRun = async (runData: DriveAutomationRun): Promise<DriveAutomationRun | null> => {
  const db = getDB();
  const collection = db.collection<DriveAutomationRun>('driveAutomationRuns');

  if (runData.n8nExecutionId) {
    const { createdAt, ...updateData } = runData;
    const result = await collection.findOneAndUpdate(
      { n8nExecutionId: runData.n8nExecutionId },
      { 
        $set: updateData,
        $setOnInsert: { createdAt: runData.createdAt }
      },
      { upsert: true, returnDocument: 'after' }
    );
    return result as DriveAutomationRun;
  } else {
    const result = await collection.insertOne(runData);
    return { ...runData, _id: result.insertedId };
  }
};

export const getLatestRun = async (): Promise<DriveAutomationRun | null> => {
  const db = getDB();
  return db.collection<DriveAutomationRun>('driveAutomationRuns').findOne(
    {},
    { sort: { createdAt: -1 } }
  );
};
