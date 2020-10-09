//@flow
import React, { type Node, useMemo } from "react";
import { Upload, Image, Typography, List, Card } from "antd";
import {
  CaretRightFilled,
  CaretDownFilled,
  CaretDownOutlined,
} from "@ant-design/icons";
import { useContext, useState, useCallback } from "react";
import { Document, Page } from "react-pdf";
import { EditorContext } from "../data/EditorContext";
import { List as ImmutableList, Record } from "immutable";
import styles from "./EditorSections.module.css";

import { pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

import type { RecordFactory, RecordOf } from "immutable";

const { Dragger } = Upload;
const { Text, Title } = Typography;

const DraggerUploadProps = {
  name: "file",
  multiple: true,
};

type Props = {
  children?: Node,
};

type FileTypeProps = {
  type: "SLIDE" | "IMAGE",
  file: ?File,
  isOpen: boolean,
  numOfPages?: number,
  _parsedPdfDoc: ?Object,
};

const defaultFileType: FileTypeProps = {
  type: "SLIDE",
  file: null,
  isOpen: false,
  numOfPages: 0,
  _parsedPdfDoc: null,
};

const makeFileRecord: RecordFactory<FileTypeProps> = Record(defaultFileType);

type FileRecord = RecordOf<FileTypeProps>;

function FileBrowser(props: Props) {
  const { collab, onFileDrop, onSlideSelect } = useContext(EditorContext);
  const [files, setFiles] = useState(ImmutableList<FileRecord>());

  const onFileChosen = (file: File) => {
    let fileType;

    switch (file.type) {
      case "application/pdf":
        fileType = "SLIDE";
        break;
      default:
        //ignore file
        return;
    }

    setFiles((files) => {
      return files.push(
        makeFileRecord({ type: fileType, file, isOpen: false })
      );
    });
    onFileDrop(file, fileType);
  };

  const fileListOrder = useMemo(() => {
    return computeFileOrder(files);
  }, [files]);

  const onDocumentLoad = useCallback((fileIndex, pdfDoc) => {
    const { numPages } = pdfDoc;
    setFiles((files) => {
      const file = files.get(fileIndex);

      return files.set(
        fileIndex,
        file.set("numOfPages", numPages).set("_parsedPdfDoc", pdfDoc)
      );
    });
  });

  const onToggleSlideFile = useCallback((fileIndex: number) => {
    setFiles((files) => {
      const file = files.get(fileIndex);
      if (!file) {
        throw new Error("No file at that index:" + fileIndex);
      }
      if (file.type !== "SLIDE") {
        throw new Error("Can't open files of type: " + file.type);
      }

      return files.set(fileIndex, file.set("isOpen", !file.get("isOpen")));
    });
  });

  if (collab.get("slides").length === 0) {
    return (
      <Dragger {...DraggerUploadProps} action={onFileChosen}>
        <Image width={75} preview={false} src={"/image-editing.svg"} />
        <Title level={5}>Drag & Drop</Title>
        <Text>
          Drop any .pdf, .jpg, .gif, .png <br /> or{" "}
          <Text underline>browse your files</Text>
        </Text>
      </Dragger>
    );
  }

  return (
    <div className={styles.sideBar}>
      {files.map((file, index) => {
        if (file.type !== "SLIDE") {
          return null;
        }
        return (
          <Document
            key={index}
            file={file.file}
            onLoadSuccess={(...args) => onDocumentLoad(index, ...args)}
          />
        );
      })}
      <List
        dataSource={fileListOrder}
        split={false}
        renderItem={(fileDesc) => {
          const { fileIndex } = fileDesc;
          const fileRecord: FileRecord = files.get(fileIndex);

          return (
            <FileListItem
              fileDesc={fileDesc}
              fileRecord={fileRecord}
              onToggleSlideFile={onToggleSlideFile}
              onSlideSelect={onSlideSelect}
            />
          );
        }}
      />
    </div>
  );
}

type FileListItemProps = {
  fileRecord: FileRecord,
  fileDesc: FileOrderDesc,
  onToggleSlideFile: (number) => void,
  onSlideSelect: (string, number, Object) => void,
};

function FileListItem({
  fileRecord,
  fileDesc,
  onToggleSlideFile,
  onSlideSelect,
}: FileListItemProps) {
  const { fileIndex, slideIndex, type } = fileDesc;
  const pdf = fileRecord._parsedPdfDoc;
  const { isOpen } = fileRecord;

  const onSlideFileClick = useCallback(() => onToggleSlideFile(fileIndex), [
    fileIndex,
  ]);

  const onSlideClick = useCallback(
    () => onSlideSelect(fileRecord.file.uid, Number(slideIndex), pdf),
    [fileDesc]
  );

  if (type === "INDEX_SLIDE") {
    return (
      <List.Item onClick={onSlideFileClick}>
        <div className={styles.fileTile}>
          <div className={styles.numberSection}>
            {isOpen ? <CaretDownOutlined /> : <CaretRightFilled />}
            <span>{fileIndex + 1}</span>
          </div>
          {pdf ? (
            <Page
              className={styles.image}
              pageIndex={slideIndex}
              width={150}
              pdf={fileRecord._parsedPdfDoc}
            />
          ) : (
            <Card style={{ width: 150 }}>Loading</Card>
          )}
        </div>
      </List.Item>
    );
  }

  if (type === "PRESENTATION_SLIDE") {
    return (
      <List.Item onClick={onSlideClick}>
        <div className={styles.fileTile}>
          <div className={styles.numberSection}>
            <span />
            <span>{Number(slideIndex) + 1}</span>
          </div>
          {pdf ? (
            <Page
              className={styles.image}
              pageIndex={slideIndex}
              width={135}
              pdf={fileRecord._parsedPdfDoc}
            />
          ) : (
            <Card style={{ width: 135 }}>Loading</Card>
          )}
        </div>
      </List.Item>
    );
  }
}

type FileOrderDesc = {
  type: "INDEX_SLIDE" | "PRESENTATION_SLIDE" | "IMAGE",
  fileIndex: number,
  slideIndex?: number,
};

const computeFileOrder = (files: ImmutableList<FileRecord>) => {
  const fileDisplayOrder: Array<FileOrderDesc> = [];

  files.forEach((fileRecord, fileIndex) => {
    fileDisplayOrder.push({ type: "INDEX_SLIDE", fileIndex, slideIndex: 0 });

    if (fileRecord.isOpen) {
      if (!fileRecord.numOfPages) {
        throw new Error(
          "Unexpected state: Num of pages not calculated yet; but file is open."
        );
      }
      Array(fileRecord.numOfPages)
        .fill()
        .map((_, i) => {
          fileDisplayOrder.push({
            type: "PRESENTATION_SLIDE",
            fileIndex,
            slideIndex: i,
          });
        });
    }
  });

  return fileDisplayOrder;
};

export default FileBrowser;
