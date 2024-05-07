import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import '../ReportTemplates/report.css';
import { Header } from '@ohif/ui';
import axios from 'axios';

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
  let labName = 'Test CT Scan Center';

  labName = labName.replace(/ /g, "_") + '.json';
  const params = useParams();
  console.log("Default param ", params);
  const editorRef = useRef();
  const contentRef = useRef();
  const [value, setValue] = useState('sample info');
  const [isActive, setIsActive] = useState(false);
  const [selectedOption, setSelectedOption] = useState('');

  const modalityValue = params.modality;
  const [modalityInfo, getModalityData] = useState([]);

  const options = [{ "id": "ct", "value": "CT" }, { "id": "ct_head", "value": "CCT HeadT" }, { "id": "mri", "value": "MRI" }, { "id": "ct3", "value": "CT3" },];



  useEffect(() => {
    fetch(`http://localhost:3300/read_modality/${modalityValue}/${labName}`)
      .then((response) => response.json())
      .then((actualData) => {
        console.log("Modality Info ", actualData)
        getModalityData(actualData.contentRef);

      })
      .catch((err) => {
        console.log(err.message);
      });
  }, []);


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
  const handleSelectChange = (event) => {
    setSelectedOption(event.target.value);
  };
  const handleSubmit = (event) => {
    event.preventDefault();
    // Handle form submission with selectedOption
    console.log('labName', labName, 'Selected option:', selectedOption, "contentRef ", contentRef.current.innerHTML);

    const url = 'http://localhost:3300/create_template';
    let data = { "labName": labName, "modality": selectedOption, "contentRef": contentRef.current.innerHTML }
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any additional headers if needed
      },
      body: JSON.stringify(data),
    };

    try {
      const res = fetch(url, options);
      //const json = res.json();
      console.log("response ", res);
    } catch (error) {
      console.error('Error:', error);
    }
  };
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
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', justifyContent: 'center' }}>
            <label htmlFor="dropdown">Select an option:</label>
            <select id="dropdown" value={selectedOption} onChange={handleSelectChange}>
              <option value="">Select</option>
              {options.map((option, index) => (
                <option value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
            <SunEditor
              ref={editorRef}
              setOptions={editorOptions}
              lang="en"
              onChange={onChangeHandler}
            />

          </div>
          <button type="submit">Submit</button>

        </form>
      </div>
    </div>
  );
};

export default CreateTemplate;
