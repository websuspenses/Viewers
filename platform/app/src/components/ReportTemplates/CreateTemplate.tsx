import React, { useEffect, useRef, useState } from 'react';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import '../ReportTemplates/report.css';
import { Header } from '@ohif/ui';

const editorOptions = {
  height: 200,
  buttonList: [
    ['undo', 'redo'],
    ['removeFormat'],
    ['bold', 'underline', 'italic', 'fontSize'],
    ['fontColor', 'hiliteColor'],
    ['align', 'horizontalRule', 'list'],
    ['table', 'link', 'image', 'imageGallery'],
    ['showBlocks', 'codeView', 'print'],
  ],
  imageRotation: false,
  fontSize: [12, 14, 16, 18, 20],
  colorList: [
    [
      '#828282',
      '#FF5400',
      '#676464',
      '#F1F2F4',
      '#FF9B00',
      '#F00',
      '#fa6e30',
      '#000',
      'rgba(255, 153, 0, 0.1)',
      '#FF6600',
      '#0099FF',
      '#74CC6D',
      '#FF9900',
      '#CCCCCC',
    ],
  ],
  imageUploadUrl: 'http://localhost:3006/chazki-gateway/orders/upload',
  imageGalleryUrl: 'http://localhost:3006/orders/gallery',
};

const CreateTemplate = () => {
  const editorRef = useRef();
  const contentRef = useRef();
  const [value, setValue] = useState('');
  const [isActive, setIsActive] = useState(false);

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    return () => {
      document.body.classList.remove('bg-black');
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      document.body.classList.remove('bg-black');
      document.body.classList.add('bg-black-on');
    } else {
      document.body.classList.remove('bg-black-on');
      document.body.classList.add('bg-black');
    }
  }, [isActive]);

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem('active_dark'));
    if (items) {
      setIsActive(items);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('active_dark', JSON.stringify(isActive));
    document.body.classList.remove('bg-black');
  }, [isActive]);

  useEffect(() => {
    console.log(editorRef.current);
  }, []);

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }
    contentRef.current.innerHTML = value;
  }, [value]);

  const onChangeHandler = content => {
    console.log(content);
    setValue(content);
  };

  function handleChangeSwitch() {
    setIsActive(!isActive);
  }

  return (
    <div>
      <Header
        isSticky
        menuOptions={[]}
        isReturnEnabled={false}
        WhiteLabeling={[]}
        isActive={isActive}
        handleChange={handleChangeSwitch}
        screen="ReportTemplateList"
      />
      <div>
        <h1 className="templateHeaderCls">Create Template</h1>
        <div style={{ display: 'grid', justifyContent: 'center' }}>
          <SunEditor
            ref={editorRef}
            setOptions={editorOptions}
            lang="en"
            onChange={onChangeHandler}
          />

          <div ref={contentRef}></div>
        </div>
      </div>
    </div>
  );
};

export default CreateTemplate;
