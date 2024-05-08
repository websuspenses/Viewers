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

const GenerateReport = () => {
  let labName = 'Test CT Scan Center';
  let hostName = 'http://ciaiteleradiology.com/pacs/dicom-web/';
  labName = labName.replace(/ /g, "_") + '.json';
  const params = useParams();
  console.log("Default param ", params);
  const editorRef = useRef();
  const contentRef = useRef();
  const [value, setValue] = useState('<p>sample info</p>');
  const [isActive, setIsActive] = useState(false);


  const modalityValue = params.mrn;
  const [modalityInfo, getModalityData] = useState('');
  const [modalityParam, setModalityParam] = useState('');
  const [selectedOption, setSelectedOption] = useState(modalityValue ? modalityValue : '');
  const options = [{ "id": "ct", "value": "CT" }, { "id": "ct_head", "value": "CCT HeadT" }, { "id": "mri", "value": "MRI" }, { "id": "ct3", "value": "CT3" },];



  useEffect(() => {
    fetch(`${hostName}studies/1.3.6.1.4.1.5962.1.1.0.0.0.1196533885.18148.0.1/metadata/reportRaw`)
      .then((response) => response.json())
      .then((actualData) => {
        console.log("Modality Info ", actualData)
        getModalityData(actualData.reportRaw);

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
    if (value !== '') {
      console.log("contentRef.current.innerHTML", contentRef, value);
      if (!contentRef.current) {
        return;
      }

      contentRef.current.innerHTML = value;
    }

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
    let contentValue = '';
    console.log("contentRef.current.innerHTML", value);
    console.log('labName', labName, 'Selected option:', selectedOption, "contentRef ", value);

    const url = `${hostName}/dicom-web/studies/${modalityValue}/addmetadata/reportRaw`;
    let data = { "data": value }
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
      <div className='templateForm'>
        <h1 className="templateHeaderCls">Create Template</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', justifyContent: 'center' }}>

            <div className="modalityDropdown">

              <label htmlFor="dropdown">Modality:</label>
              <select name='selectedOption' disabled={modalityInfo && modalityInfo !== '' ? true : false} id="dropdown" value={selectedOption} onChange={handleSelectChange}>
                <option value="">Select</option>
                {options.map((option, index) => (
                  <option key={index} value={option.value}>
                    {option.value}
                  </option>
                ))}
              </select>
            </div>
            <SunEditor
              ref={editorRef}
              setOptions={editorOptions}
              lang="en"
              onChange={onChangeHandler}
              setContents={modalityInfo}
            />
            <button className='submitButton' type="submit">Submit</button>
          </div>


        </form>
      </div>
    </div>
  );
};

export default GenerateReport;
