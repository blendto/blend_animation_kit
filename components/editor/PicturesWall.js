import { Upload, Modal } from "antd";
import { PlusOutlined } from "@ant-design/icons";

function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

const iconOptions = {
  showRemoveIcon: false,
};

export default class PicturesWall extends React.Component {
  state = {
    previewVisible: false,
    previewImage: "",
    previewTitle: "",
    fileList: [],
  };

  handleCancel = () => this.setState({ previewVisible: false });

  handlePreview = async (file) => {
    const filePreview = await getBase64(file.originFileObj);
    this.props.onPreview?.(file.uid, filePreview);
  };

  handleChange = ({ fileList }) => {
    this.setState({ fileList });
    this.props.onChange?.(fileList);
  };

  render() {
    const { previewVisible, previewImage, fileList, previewTitle } = this.state;

    const { action, id } = this.props;
    const uploadButton = (
      <div>
        <PlusOutlined />
        <div style={{ marginTop: 8 }}>Drag & Drop or Choose Files</div>
      </div>
    );
    return (
      <>
        <Upload
          multiple
          accept="image/*"
          action={"/api/image"}
          data={(file) => ({ file, collabId: id })}
          listType="picture-card"
          fileList={fileList}
          showUploadList={iconOptions}
          onPreview={this.handlePreview}
          onChange={this.handleChange}
        >
          {uploadButton}
        </Upload>
        <Modal
          visible={previewVisible}
          title={previewTitle}
          footer={null}
          onCancel={this.handleCancel}
        >
          <img alt="example" style={{ width: "100%" }} src={previewImage} />
        </Modal>
      </>
    );
  }
}
