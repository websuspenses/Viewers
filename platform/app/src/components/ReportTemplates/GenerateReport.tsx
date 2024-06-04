import React, { useEffect, useRef, useState } from 'react';
import { json, useParams } from 'react-router-dom';
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
const customPlugin = {
  // @Required @Unique
  name: 'custom_example',
  innerHTML: '<img src="/ohif-logo.svg" alt="OHIF Logo fadfdfsfdsfsd">',
};
const editorOptions = {
  plugins: [customPlugin],
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
  imageUploadUrl: 'http://localhost:3006/chazki-gateway/orders/upload',
  imageGalleryUrl: 'http://localhost:3006/orders/gallery',
};

const GenerateReport = () => {
  const navigate = useNavigate();
  const labId = 2;
  const hostName = 'http://ciaiteleradiology.com/pacs/dicom-web/';
  const nodeAppHost = 'http://localhost:3300';
  // labName = labName.replace(/ /g, '_') + '.json';
  const params = useParams();
  console.log('Default param ', params);
  const editorRef = useRef();
  const contentRef = useRef();
  //const contentModalityRef = useRef(null);
  const [value, setValue] = useState('<p>sample info</p>');
  const [isActive, setIsActive] = useState(false);

  const modalityValue = params.mrn;
  const modality = params.modality;
  const [modalityInfo, getModalityData] = useState('');
  const [modalitytemplateInfo, getModalityTemplateDate] = useState('');

  const [selectedOption, setSelectedOption] = useState(modalityValue ? modalityValue : '');

  const [modalitydata, setModalityData] = useState('<p>sample modality</p>');
  const [currentDate, setCurrentDate] = useState(new Date());

  const options = [
    { id: 'ct', value: 'CT' },
    { id: 'ct_head', value: 'CCT HeadT' },
    { id: 'mri', value: 'MRI' },
    { id: 'ct3', value: 'CT3' },
  ];

  useEffect(() => {
    fetch(`${hostName}studies/${modalityValue}/metadata/reportRaw`)
      .then(response => response.json())
      .then(actualData => {
        console.log('Modality Info 1st API  ', actualData);
        getModalityData(actualData.reportRaw);
      })
      .catch(err => {
        console.log(err.message);
      });
    GetStudyData();
  }, []);

  useEffect(() => {
    fetch(`${nodeAppHost}/read_study_template_for_generate/${labId}/${modality}`)
      .then(response => response.json())
      .then(actualData => {
        console.log('actualData', actualData);
        let updatedTemplateInfo;
        if (modalityInfo === '') {
          console.log('Modality template Info 2nd API IF', modalitydata);
          const p_modality = modalitydata['00080061'] ? modalitydata['00080061'].Value[0] : '';
          const p_name = modalitydata['00100010']
            ? modalitydata['00100010'].Value[0].Alphabetic
            : '';

          const p_desc = modalitydata['00081030'] ? modalitydata['00081030'].Value[0] : '';
          const p_age = modalitydata['00101010'] ? modalitydata['00101010'].Value[0] : '';
          const patientInfo = `
            <p class="patient-info-span" style="width: 200px">

              <b>Patient name :</b>&nbsp;${p_name}
              <br />
              <b>Modality :</b>&nbsp;
              ${p_modality}
            <br />
              <b>Study description :</b>&nbsp;${p_desc}
              <br />
              <b>Date:</b>&nbsp;
              ${formattedDate}
            </p>

            <img
              width="100px"
              height="60px"
              src="/ohif-logo.svg"
              alt="OHIF Logo"
            />`;
          console.log('Modality template Info 2nd API IF patientInfo', patientInfo);
          updatedTemplateInfo = patientInfo + '<br/>' + actualData.data.template_content;
        } else {
          console.log('Modality template Info 2nd API ELSE ', modalityInfo);
          updatedTemplateInfo = modalityInfo;
        }

        getModalityTemplateDate(updatedTemplateInfo);
      })
      .catch(err => {
        console.log(err.message);
      });
  }, [modalitydata, modalityInfo]);

  function GetStudyData() {
    fetch(
      `${hostName}studies?StudyInstanceUID=${modalityValue}&&includefield=00101010,00101040,00081030`
    )
      .then(response => response.json())
      .then(actualData => {
        setModalityData(actualData[0]);
      })
      .catch(err => {
        console.log(err.message);
      });
  }

  const updateDate = () => {
    setCurrentDate(new Date());
  };

  // Use useEffect to update the current date every second
  useEffect(() => {
    const intervalId = setInterval(updateDate, 1000);
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array to run the effect only once on component mount

  // Format the date as DD/MM/YYYY
  const formattedDate = `${currentDate.getDate().toString().padStart(2, '0')}/${(
    currentDate.getMonth() + 1
  )
    .toString()
    .padStart(2, '0')}/${currentDate.getFullYear()}`;

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    document.body.classList.add('reportsList_ContainerCls');
    return () => {
      document.body.classList.remove('bg-black');
      document.body.classList.remove('reportsList_ContainerCls');
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
      console.log('contentRef.current.innerHTML', contentRef, value);
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
  const handleSelectChange = event => {
    setSelectedOption(event.target.value);
  };

  const handleSubmit = event => {
    event.preventDefault();
    // Handle form submission with selectedOption
    const contentValue = '';
    console.log('contentRef.current.innerHTML', value);

    const url = `${hostName}studies/${modalityValue}/addmetadata/reportRaw`;
    const data = { data: value };
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
      console.log('response ', res);
      if (res) {
        navigate('/workList');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };
  const handleSubmit1 = event => {
    event.preventDefault();
    // Handle form submission with selectedOption
    const contentValue = '';
    console.log('contentRef.current.innerHTML', value);
    // console.log('labName', labName, 'Selected option:', selectedOption, 'contentRef ', value);

    const url = `${hostName}/studies/${modalityValue}/addmetadata/reportRaw`;
    const data = { data: data + value };
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
        navigate('/workList');
      }
      //const json = res.json();
      console.log('response ', res);
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
        WhiteLabeling={{}}
        isActive={isActive}
        handleChange={handleChangeSwitch}
        screen="GenerateReport"
        modalityValue={modalityValue}
      />
      <div className="templateForm">
        <h1 className="templateHeaderCls">Study Report</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', justifyContent: 'center' }}>
            {/* <div className="modalityDropdown">
              <label htmlFor="dropdown">Modality:</label>
              <select
                name="selectedOption"
                disabled={modalityInfo && modalityInfo !== '' ? true : false}
                id="dropdown"
                value={selectedOption}
                onChange={handleSelectChange}
              >
                <option value="">Select</option>
                {options.map((option, index) => (
                  <option
                    key={index}
                    value={option.value}
                  >
                    {option.value}
                  </option>
                ))}
              </select>
            </div> */}

            <SunEditor
              ref={editorRef}
              setOptions={editorOptions}
              lang="en"
              onChange={onChangeHandler}
              setContents={modalitytemplateInfo}
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

export default GenerateReport;