import 'dotenv/config';
import Replicate from 'replicate';

const token = process.env.REPLICATE_API_TOKEN;

if (!token) {
  console.error('Missing REPLICATE_API_TOKEN');
  process.exit(1);
}

const client = new Replicate({ auth: token });

const modelSlug = process.argv[2] ?? 'bytedance/seedream-4';

const run = async () => {
  try {
    const [owner, name] = modelSlug.split('/');
    if (!owner || !name) {
      throw new Error(`Invalid model slug: ${modelSlug}`);
    }
    const model = await client.models.get(owner, name);
    console.log(`Model: ${model.owner}/${model.name}`);
    console.log(JSON.stringify(model, null, 2));
  } catch (error: any) {
    console.error('Failed to inspect model');
    console.error(error?.message ?? error);
    process.exit(1);
  }
};

run();
