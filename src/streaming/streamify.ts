import { Readable, Writable, Duplex, DuplexOptions } from 'stream';

/**
 * Events emitted by the source stream.
 */
const SOURCE_EVENTS = ['error', 'close'];

/**
 * Events emitted by the destination stream.
 */
const DEST_EVENTS = ['drain', 'close'];

/**
 * Options for configuring the Streamify class.
 */
interface StreamifyOptions {
  readable?: boolean;
  writable?: boolean;
}

/**
 * The encoding types for buffers.
 */
type BufferEncoding = 'ascii' | 'utf8' | 'utf16le' | 'ucs2' | 'base64' | 'latin1' | 'binary' | 'hex';

/**
 * Represents a source stream.
 */
interface Source {
  stream: Readable;
  listeners: { [key: string]: (...args: any[]) => void };
  onend: () => void;
  onreadable?: () => void;
}

/**
 * Represents a destination stream.
 */
interface Dest {
  stream: Writable;
  listeners: { [key: string]: (...args: any[]) => void };
}

/**
 * A duplex stream that combines a readable and writable stream.
 */
class Streamify extends Duplex {
  private _source?: Source;
  private _dest?: Dest;
  private _sourceRead?: number;
  private _destWritten: [any, BufferEncoding, (error?: Error | null) => void][];

  private _readable: boolean;
  private _writable: boolean;

  /**
   * Creates an instance of Streamify.
   * @param options - Options for configuring the Streamify instance.
   */
  constructor(options: StreamifyOptions = {}) {
    const { readable = true, writable = true } = options;

    const duplexOptions: DuplexOptions = {
      allowHalfOpen: true,
    };

    super(duplexOptions);

    this._readable = readable;
    this._writable = writable;
    this._destWritten = [];

    if (writable) {
      this.once('finish', () => {
        if (this._dest) {
          this._dest.stream.end();
        }
      });
    }
  }

  /**
   * Implements the _read method of the Duplex class.
   * @param size - The number of bytes to read.
   */
  _read(size: number): void {
    if (this._source) {
      const onreadable = this._source.onreadable = () => {
        if (!this._source) { return; }
        const data = this._source.stream.read(size);
        if (data) {
          this.push(data);
        } else {
          this._source.stream.once('readable', onreadable);
        }
      };
      onreadable();
    } else {
      this._sourceRead = size;
    }
  }

  /**
   * Implements the _write method of the Duplex class.
   * @param chunk - The chunk of data to write.
   * @param encoding - The encoding of the chunk.
   * @param callback - The callback function to invoke when the write operation is complete.
   */
  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    if (this._dest) {
      this._dest.stream.write(chunk, encoding, callback);
    } else {
      this._destWritten.push([chunk, encoding, callback]);
    }
  }

  /**
   * Adds a source stream to the Streamify instance.
   * @param stream - The source stream to add.
   */
  addSource(stream: Readable): void {
    if (this._source) {
      throw new Error('A source stream has already been added.');
    }

    const onend = () => { this.push(null); };
    this._source = { stream, listeners: {}, onend };

    SOURCE_EVENTS.forEach((event) => {
      const onevent = this._source!.listeners[event] = (arg: any) => {
        this.emit(event, arg);
      };
      stream.on(event, onevent);
    });

    stream.on('end', onend);
    this._read(this._sourceRead!);
  }

  /**
   * Removes the source stream from the Streamify instance.
   */
  removeSource(): void {
    if (!this._source) {
      throw new Error('A source stream has not been added.');
    }

    const source = this._source;
    SOURCE_EVENTS.forEach((event) => {
      source.stream.removeListener(event, source.listeners[event]);
    });
    source.stream.removeListener('readable', source.onreadable!);
    source.stream.removeListener('end', source.onend);

    delete this._source;
  }

  /**
   * Adds a destination stream to the Streamify instance.
   * @param stream - The destination stream to add.
   */
  addDest(stream: Writable): void {
    if (this._dest) {
      throw new Error('A destination stream has already been added.');
    }

    this._dest = { stream, listeners: {} };

    DEST_EVENTS.forEach((event) => {
      const onevent = this._dest!.listeners[event] = (arg: any) => {
        this.emit(event, arg);
      };
      stream.on(event, onevent);
    });

    if (this._destWritten.length) {
      this._destWritten.forEach((args) => {
        stream.write.apply(stream, args);
      });
      this._destWritten = [];
    }
  }

  /**
   * Removes the destination stream from the Streamify instance.
   */
  removeDest(): void {
    if (!this._dest) {
      throw new Error('A destination stream has not been added.');
    }

    const dest = this._dest;
    DEST_EVENTS.forEach((event) => {
      dest.stream.removeListener(event, dest.listeners[event]);
    });

    delete this._dest;
    this._destWritten = [];
  }

  /**
   * Resolves a stream as either a source or destination based on the Streamify options.
   * @param stream - The stream to resolve.
   */
  resolve(stream: Readable | Writable): void {
    if (this._readable && stream instanceof Readable) {
      this.addSource(stream);
    }

    if (this._writable && stream instanceof Writable) {
      this.addDest(stream);
    }
  }

  /**
   * Unresolves the source and destination streams from the Streamify instance.
   */
  unresolve(): void {
    if (this._source) {
      this.removeSource();
    }

    if (this._dest) {
      this.removeDest();
    }
  }
}

/**
 * Creates a new instance of Streamify.
 * @param options - Options for configuring the Streamify instance.
 * @returns A new instance of Streamify.
 */
export default function streamify(options?: StreamifyOptions): Streamify {
  return new Streamify(options);
}
