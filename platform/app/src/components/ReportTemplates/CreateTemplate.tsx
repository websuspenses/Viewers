import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import '../ReportTemplates/report.css';
import { Header } from '@ohif/ui';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const defaultFonts = [
  'Arial',
  'Comic Sans MS',
  'Courier New',
  'Impact',
  'Georgia',
  'Tahoma',
  'Trebuchet MS',
  'Verdana',
];

const sortedFontOptions = [
  'Logical',
  'Salesforce Sans',
  'Garamond',
  'Sans-Serif',
  'Serif',
  'Times New Roman',
  'Helvetica',
  ...defaultFonts,
].sort();

const editorOptions = {
  height: 200,
  buttonList: [
    ['undo', 'redo'],
    ['removeFormat'],
    ['bold', 'underline', 'italic', 'font', 'fontSize'],
    ['fontColor', 'hiliteColor'],
    ['align', 'horizontalRule', 'list', 'lineHeight'],
    ['table', 'link', 'image', 'imageGallery'],
    ['showBlocks', 'codeView', 'print'],
  ],
  imageRotation: false,
  font: sortedFontOptions,
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
  const navigate = useNavigate();

  let labName = 'Test CT Scan Center';
  const nodeAppHost = 'http://localhost:3300';

  labName = labName.replace(/ /g, '_') + '.json';
  const params = useParams();
  console.log('Default param ', params);
  const editorRef = useRef();
  const contentRef = useRef();
  const [value, setValue] = useState('<p>sample info</p>');
  const [isActive, setIsActive] = useState(false);

  const modalityValue = params.modality;
  const templateValue = params.template_id;

  const [modalityInfo, getModalityData] = useState('');
  const [modalityParam, setModalityParam] = useState('');
  const [selectedOption, setSelectedOption] = useState(modalityValue ? modalityValue : '');
  const [modalityOptionsList, setModalityOptionsList] = useState([]);
  const [updateModality, setUpdateModality] = useState([]);
  const [updateTemplateInfo, setUpdateTemplateInfo] = useState('');
  const labId = 2;

  useEffect(() => {
    fetch(`${nodeAppHost}/read_modalities`)
      .then(response => response.json())
      .then(actualData => {
        console.log('Modality Info ', actualData);
        setModalityOptionsList(actualData.data);
      })
      .catch(err => {
        console.log(err.message);
      });
  }, []);

  useEffect(() => {
    if (modalityValue) {
      fetch(`${nodeAppHost}/read_study_template/${labId}/${templateValue}`)
        .then(response => response.json())
        .then(actualData => {
          console.log('Modality Info ', actualData);
          setUpdateModality(actualData.data);
          setUpdateTemplateInfo(actualData && actualData.data[0].template_content);
        })
        .catch(err => {
          console.log(err.message);
        });
    }
  }, [modalityValue]);

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
      document.body.classList.remove('reportsList_ContainerCls');
    } else {
      document.body.classList.add('reportsList_ContainerCls');
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
      console.log('contentRef.current.innerHTML', contentRef, value);
      if (!contentRef.current) {
        return;
      }

      contentRef.current.innerHTML = value;
    }
  }, [value]);

  const onChangeHandler = content => {
    console.log('content', content);
    setValue(content);
  };

  function handleChangeSwitch() {
    setIsActive(!isActive);
  }
  const handleSelectChange = event => {
    setSelectedOption(event.target.value);
  };
  const handleSubmit = event => {
    event.preventDefault();
    // Handle form submission with selectedOption
    let contentValue = '';
    console.log('contentRef.current.innerHTML', value);
    if (contentRef.current) {
      contentValue = contentRef.current.innerHTML;
    }
    console.log('labName', labName, 'Selected option:', selectedOption, 'contentRef ', value);

    if (!modalityValue && !templateValue) {
      const url = `${nodeAppHost}/create_template`;

      const data = { modality: selectedOption, template_content: value, lab_id: 2 };
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
        if (res) {
          console.log('res', res);
          navigate('/report-templates');
        }
        //const json = res.json();
        console.log('response ', res);
      } catch (error) {
        console.error('Error:', error);
      }
    } else {
      const url = `${nodeAppHost}/update_template`;

      const data = { modality: selectedOption, template_content: value };
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
        if (res) {
          console.log('res', res);
          navigate('/report-templates');
        }
        //const json = res.json();
        console.log('response ', res);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  return (
    <div>
      <Header
        isSticky
        menuOptions={[]}
        isReturnEnabled={false}
        WhiteLabeling={{}}
        isActive={isActive}
        handleChange={handleChangeSwitch}
        screen="ReportTemplateList"
      />
      <div className="templateForm">
        <h1 className="templateHeaderCls">
          {modalityValue ? 'Update Template' : 'Create Template'}
        </h1>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', justifyContent: 'center' }}>
            <div className="modalityDropdown">
              <label htmlFor="dropdown">Modality:</label>
              <select
                name="selectedOption"
                disabled={modalityInfo && modalityInfo !== '' ? true : false}
                id="dropdown"
                value={selectedOption}
                onChange={handleSelectChange}
              >
                <option value="">Select</option>
                {modalityOptionsList.map((option, index) => (
                  <option
                    key={index}
                    value={option.modality_name}
                  >
                    {option.modality_description}
                  </option>
                ))}
              </select>
            </div>
            <SunEditor
              ref={editorRef}
              setOptions={editorOptions}
              lang="en"
              onChange={onChangeHandler}
              setContents={modalityValue ? updateTemplateInfo : modalityInfo}
            />
            <button
              className="submitButton"
              type="submit"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTemplate;