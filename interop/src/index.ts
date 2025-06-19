import { WebTransport } from 'webtransport';
import {
  serializeClientSetup,
  serializeSubscribe,
  serializeUnsubscribe,
  serializeAnnounce,
  serializeUnannounce,
  serializeFetch,
  serializeFetchCancel,
  serializeGoaway,
  serializeTrackStatusRequest,
  serializeDatagram,
  serializeSubgroupHeader,
  serializeSubgroupObject,
  MOQT_SUPPORTED_VERSIONS,
  GROUP_ORDER,
  SUBSCRIBE_FILTER,
  FETCH_TYPE,
} from 'moqtail';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

interface Args {
  server: string;
}

function parseArgs(): Args {
  const [, , ...rest] = process.argv;
  const args: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    args[rest[i].replace(/^--/, '')] = rest[i + 1];
  }
  if (!args.server) {
    console.error('Usage: node dist/index.js --server <url>');
    process.exit(1);
  }
  return { server: args.server };
}

async function sendControlMessage(writer: WritableStreamDefaultWriter, data: Uint8Array) {
  await writer.write(data);
  writer.releaseLock();
}

async function main() {
  const { server } = parseArgs();
  const wt = new WebTransport(server);
  await wt.ready;
  const controlStream = await wt.createBidirectionalStream({ sendOrder: 0 });
  const controlWriter = controlStream.writable.getWriter();
  await sendControlMessage(
    controlWriter,
    serializeClientSetup({ supportedVersions: MOQT_SUPPORTED_VERSIONS })
  );

  const datagramWriter = wt.datagrams.writable.getWriter();
  const rl = readline.createInterface({ input, output });

  async function prompt(question: string, def: string) {
    const ans = await rl.question(`${question} (${def}): `);
    return ans.trim() || def;
  }

  const menu = [
    'Subscribe',
    'Unsubscribe',
    'Fetch',
    'Fetch Cancel',
    'Announce',
    'Unannounce',
    'Goaway',
    'Track Status Request',
    'Send Datagram',
    'Send Subgroup Object',
    'Exit',
  ];

  let exit = false;
  while (!exit) {
    output.write('\nSelect message to send:\n');
    menu.forEach((m, i) => output.write(`${i + 1}) ${m}\n`));
    const choice = parseInt(await prompt('> ', '1'), 10);

    const writer = controlStream.writable.getWriter();

    switch (choice) {
      case 1: {
        const subscribeId = parseInt(await prompt('subscribeId', '1'), 10);
        const trackAlias = parseInt(await prompt('trackAlias', '0'), 10);
        const name = await prompt('trackName', 'video');
        const ns = await prompt('trackNamespace comma-separated', 'example');
        const msg = serializeSubscribe({
          subscribeId,
          trackAlias,
          trackNamespace: ns.split(',').map((s) => s.trim()),
          trackName: name,
          subscriberPriority: 0,
          groupOrder: GROUP_ORDER.PUBLISHER,
          filterType: SUBSCRIBE_FILTER.LATEST_OBJECT,
        });
        await sendControlMessage(writer, msg);
        break;
      }
      case 2: {
        const subscribeId = parseInt(await prompt('subscribeId', '1'), 10);
        await sendControlMessage(writer, serializeUnsubscribe(subscribeId));
        break;
      }
      case 3: {
        const subscribeId = parseInt(await prompt('subscribeId', '1'), 10);
        const name = await prompt('trackName', 'video');
        const ns = await prompt('trackNamespace comma-separated', 'example');
        const msg = serializeFetch({
          subscribeId,
          subscriberPriority: 0,
          groupOrder: GROUP_ORDER.PUBLISHER,
          fetchType: FETCH_TYPE.STANDALONE,
          trackNamespace: ns.split(',').map((s) => s.trim()),
          trackName: name,
          startGroup: 0,
          startObject: 0,
          endGroup: 0,
          endObject: 0,
        });
        await sendControlMessage(writer, msg);
        break;
      }
      case 4: {
        const subscribeId = parseInt(await prompt('subscribeId', '1'), 10);
        await sendControlMessage(writer, serializeFetchCancel(subscribeId));
        break;
      }
      case 5: {
        const ns = await prompt('trackNamespace comma-separated', 'example');
        await sendControlMessage(
          writer,
          serializeAnnounce({ trackNamespace: ns.split(',').map((s) => s.trim()) })
        );
        break;
      }
      case 6: {
        const ns = await prompt('trackNamespace comma-separated', 'example');
        await sendControlMessage(
          writer,
          serializeUnannounce({ trackNamespace: ns.split(',').map((s) => s.trim()) })
        );
        break;
      }
      case 7: {
        const uri = await prompt('newSessionUri', '');
        await sendControlMessage(writer, serializeGoaway({ newSessionUri: uri }));
        break;
      }
      case 8: {
        const name = await prompt('trackName', 'video');
        const ns = await prompt('trackNamespace comma-separated', 'example');
        await sendControlMessage(
          writer,
          serializeTrackStatusRequest({ trackNamespace: ns.split(',').map((s) => s.trim()), trackName: name })
        );
        break;
      }
      case 9: {
        const trackAlias = parseInt(await prompt('trackAlias', '0'), 10);
        const groupId = parseInt(await prompt('groupId', '0'), 10);
        const objectId = parseInt(await prompt('objectId', '0'), 10);
        const datagram = serializeDatagram({
          trackAlias,
          groupId,
          objectId,
          publisherPriority: 0,
          extensionHeaders: [],
          payload: new TextEncoder().encode('hello world'),
        });
        await datagramWriter.write(datagram);
        break;
      }
      case 10: {
        const trackAlias = parseInt(await prompt('trackAlias', '0'), 10);
        const groupId = parseInt(await prompt('groupId', '0'), 10);
        const subgroupId = parseInt(await prompt('subgroupId', '0'), 10);
        const objectId = parseInt(await prompt('objectId', '0'), 10);
        const header = serializeSubgroupHeader({
          trackAlias,
          groupId,
          subgroupId,
          publisherPriority: 0,
        });
        const stream = await wt.createUnidirectionalStream();
        const swriter = stream.getWriter();
        await swriter.write(header);
        const object = serializeSubgroupObject({
          objectId,
          extensionHeaders: [],
          payload: new TextEncoder().encode('hello world'),
        });
        await swriter.write(object);
        await swriter.close();
        break;
      }
      default:
        exit = true;
        break;
    }
  }

  rl.close();
  await wt.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
