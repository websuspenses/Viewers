import React, { useEffect, useRef, useState } from 'react';
import { json, useParams } from 'react-router-dom';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import '../ReportTemplates/report.css';
import { Header } from '@ohif/ui';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  align,
  font,
  fontColor,
  fontSize,
  formatBlock,
  hiliteColor,
  horizontalRule,
  lineHeight,
  list,
  paragraphStyle,
  table,
  template,
  textStyle,
  image,
  link
} from "suneditor/src/plugins";
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
let addOnPlugins1 = {

  align,
  image,
  template

};
const editorOptions = {
  plugins: [addOnPlugins1],
  maxWidth: '1070px',
  minHeight: "50vh",
  maxHeight: "50vh",
  buttonList: [
    ['undo', 'redo'],
    ['font', 'fontSize', 'formatBlock'],
    ['paragraphStyle', 'blockquote'],
    ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
    ['fontColor', 'hiliteColor', 'textStyle'],
    ['removeFormat'],
    ['outdent', 'indent'],
    ['align', 'horizontalRule', 'list', 'lineHeight'],
    ['table', 'link', 'image'],
    ['fullScreen', 'showBlocks', 'codeView'],
    ['preview', 'print', 'save'],
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
  ]
};

const GenerateReport = () => {
  const iframeBaseUrl = window.location.origin;
  const navigate = useNavigate();
  const labId = sessionStorage.getItem('labId') || '';
  const hostName = process.env.REACT_APP_PACS_HOST;
  const nodeAppHost = process.env.REACT_APP_HOST_NAME;
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
  const reportType = params.type;
  const [modalityInfo, getModalityData] = useState('');
  const [modalitytemplateInfo, getModalityTemplateDate] = useState('');

  const [selectedOption, setSelectedOption] = useState(modalityValue ? modalityValue : '');

  const [modalitydata, setModalityData] = useState('<p>sample modality</p>');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [authHeaders, setAuthHeaders] = useState('');
  const clientId = window.config.oidc[0].client_id;

  useEffect(() => {
    //fetch(`${hostName}studies/${modalityValue}/metadata/reportRaw`);
    //const authHeaders = localStorage.getItem('auth-t');
    console.log('local headers --> read_study_template ', authHeaders);
    if (authHeaders) {
      console.log('Inside local headers --> read_study_template ', authHeaders);
      fetch(`${hostName}studies/${modalityValue}/metadata/reportRaw`, {
        method: 'GET',
        headers: {
          Authorization: authHeaders,
        },
      })
        .then(response => response.json())
        .then(actualData => {
          console.log('Modality Info 1st API  ', actualData);
          getModalityData(actualData.reportRaw);
        })
        .catch(err => {
          console.log(err.message);
        });
      GetStudyData();
    }
  }, [authHeaders]);

  useEffect(() => {
    const sessInfo = JSON.parse(sessionStorage.getItem(`oidc.user:${window.config.oidc[0].authority}:${window.config.oidc[0].client_id}`));
    let authHeaders = sessInfo.token_type + ' ' + sessInfo.access_token;
    console.log("local headers ", authHeaders);
    setAuthHeaders(authHeaders);
  }, []);

  useEffect(() => {
    //fetch(`${nodeAppHost}/read_study_template_for_generate/${labId}/${modality}`)
    //const authHeaders = localStorage.getItem('auth-t');
    console.log('local headers --> read_study_template ', authHeaders);
    if (authHeaders) {
      fetch(`${nodeAppHost}/read_study_template_for_generate/${labId}/${modality}/${reportType}`, {
        method: 'GET',
        // headers: {
        //   Authorization: authHeaders,
        // },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeaders,
          'clientId': clientId,
          'realm': clientId,
          'isAccess': 'read_study_template_for_generate',
          'labId': labId,
          'abcdefg': 'AAAAA',
          'x1234': 'BBBBB_' + labId,
        },
      })
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
            </p>`;
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
    }
  }, [modalitydata, modalityInfo, authHeaders]);

  function GetStudyData() {
    console.log('local headers --> read_study_template ', authHeaders);
    fetch(
      `${hostName}studies?StudyInstanceUID=${modalityValue}&&includefield=00101010,00101040,00081030`,
      {
        method: 'GET',
        headers: {
          Authorization: authHeaders,
        },
      }
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
    let fiftyPerFlag = localStorage.getItem('fiftyPerFlag')

    const contentValue = '';
    console.log('contentRef.current.innerHTML', value);
    //const authHeaders = localStorage.getItem('auth-t');
    const url = `${hostName}studies/${modalityValue}/addmetadata/reportRaw`;
    const data = { data: value };
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeaders,
      },
      body: JSON.stringify(data),
    };


    const isReportGeneratedURL = `${hostName}/studies/${modalityValue}/addmetadata/isReportGenerated`;

    let formData = { "data": 'true' };

    const isReportGeneratedOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeaders,
      },
      body: JSON.stringify(formData),
    };

    try {
      const res = fetch(url, options);
      // Update is isReportGenerated flag here


      const res2 = fetch(isReportGeneratedURL, isReportGeneratedOptions);


      Promise.all([
        res, res2
      ])
        .then(([response1, response2]) => {
          console.log('Generate Report updated', response1, "response2 ", response2);
          let url2 = `${hostName}studies/${modalityValue}/update_status`;
          const statusBody = { "status": "Report Generated" };
          const options2 = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authHeaders,
            },
            body: JSON.stringify(statusBody),
          };

          try {
            const res1 = fetch(url2, options2);
            if (res1) {
              sessionStorage.setItem('stuID', modalityValue);
              sessionStorage.setItem('isReportGenerated', true);
              if (fiftyPerFlag == "true") {
                alert("Report generated Successfully...");
                //localStorage.setItem('fiftyPerFlag', 'false');
                //localStorage.setItem('sid', "");
                //localStorage.setItem('mdFlag', "");
                window.location.reload();
                //navigate('/workList');
              } else {
                navigate('/workList');
                alert("Report generated Successfully...");
                console.log('Status updated Generate report', res1);
              }
            }
            console.log('response ', res1);
          } catch (error) {
            console.error('Error:', error);
          }
        })
        .catch(error => {
          console.error('Error:', error);
        });





      // if (res) {
      //   console.log('Generate Report', res);
      //   let url2 = `${hostName}studies/${modalityValue}/update_status`;
      //   const statusBody = { "status": "Report Generated" };
      //   const options2 = {
      //     method: 'POST',
      //     headers: {
      //       'Content-Type': 'application/json',
      //       Authorization: authHeaders,
      //     },
      //     body: JSON.stringify(statusBody),
      //   };

      //   try {
      //     const res1 = fetch(url2, options2);
      //     if (res1) {
      //       if (fiftyPerFlag == "true") {
      //         alert("Report generated Successfully...");
      //         //localStorage.setItem('fiftyPerFlag', 'false');
      //         //localStorage.setItem('sid', "");
      //         //localStorage.setItem('mdFlag', "");
      //         window.location.reload();
      //         //navigate('/workList');
      //       } else {
      //         navigate('/workList');
      //         alert("Report generated Successfully...");
      //         console.log('Status updated Generate report', res1);
      //       }
      //     }
      //     console.log('response ', res1);
      //   } catch (error) {
      //     console.error('Error:', error);
      //   }

      //   //navigate('/workList');
      // }
    } catch (error) {
      console.error('Error:', error);
    }
  };


  const handleRedirectPage = () => {
    navigate('/workList');
  }

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
        handleRedirectPage={handleRedirectPage}
        modalityValue={modalityValue}
      />
      <div className="templateForm">
        <h1 className="templateHeaderCls">Study Report</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', justifyContent: 'center' }}>


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
