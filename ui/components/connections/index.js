import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  NoSsr,
  TableCell,
  Button,
  Tooltip,
  FormControl,
  Select,
  TableContainer,
  Table,
  Grid,
  TableRow,
  TableSortLabel,
  IconButton,
  Typography,
  Switch,
  Popover,
  AppBar,
  Tabs,
  Tab,
  MenuItem,
  Box,
} from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import Moment from 'react-moment';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { updateProgress } from '../../lib/store';
import dataFetch from '../../lib/data-fetch';
import { useNotification } from '../../utils/hooks/useNotification';
import { EVENT_TYPES } from '../../lib/event-types';
import CustomColumnVisibilityControl from '../../utils/custom-column';
import SearchBar from '../../utils/custom-search';
import ResponsiveDataTable from '../../utils/data-table';
import useStyles from '../../assets/styles/general/tool.styles';
import Modal from '../Modal';
import { iconMedium, iconSmall } from '../../css/icons.styles';
import PromptComponent, { PROMPT_VARIANTS } from '../PromptComponent';
import resetDatabase from '../graphql/queries/ResetDatabaseQuery';
import changeOperatorState from '../graphql/mutations/OperatorStatusMutation';
import fetchMesheryOperatorStatus from '../graphql/queries/OperatorStatusQuery';
import MesherySettingsEnvButtons from '../MesherySettingsEnvButtons';
import styles from './styles';
import MeshSyncTable from './MeshsyncTable';
import ConnectionIcon from '../../assets/icons/Connection';
import MeshsyncIcon from '../../assets/icons/Meshsync';
import classNames from 'classnames';
// import CheckCircleIcon from '@mui/icons-material/CheckCircle';
// import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import SyncIcon from '@mui/icons-material/Sync';
// import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
// import ExploreIcon from '@mui/icons-material/Explore';
import { CONNECTION_STATES } from '../../utils/Enum';
import { FormatConnectionMetadata } from './metadata';
import useKubernetesHook from '../hooks/useKubernetesHook';
import theme from '../../themes/app';
import { ConnectionChip, ConnectionStateChip } from './ConnectionChip';
import InfoIcon from '@material-ui/icons/Info';

const ACTION_TYPES = {
  FETCH_CONNECTIONS: {
    name: 'FETCH_CONNECTIONS',
    error_msg: 'Failed to fetch connections',
  },
  UPDATE_CONNECTION: {
    name: 'UPDATE_CONNECTION',
    error_msg: 'Failed to update connection',
  },
  DELETE_CONNECTION: {
    name: 'DELETE_CONNECTION',
    error_msg: 'Failed to delete connection',
  },
};

const ENABLED = 'ENABLED';
const DISABLED = 'DISABLED';
const KUBERNETES = 'kubernetes';

/**
 * Parent Component for Connection Component
 *
 * @important
 * - Keep the component's responsibilities focused on connection management. Avoid adding unrelated functionality and state.
 */

function ConnectionManagementPage(props) {
  const [createConnectionModal, setCreateConnectionModal] = useState({
    open: false,
  });
  const [createConnection, setCreateConnection] = useState({});

  const handleCreateConnectionModalOpen = () => {
    setCreateConnectionModal({ open: true });
  };

  const handleCreateConnectionModalClose = () => {
    setCreateConnectionModal({ open: false });
  };

  const handleCreateConnectionSubmit = () => {};

  useEffect(() => {
    dataFetch(
      '/api/schema/resource/helmRepo',
      {
        method: 'GET',
        credentials: 'include',
      },
      (result) => {
        setCreateConnection(result);
      },
    );
  }, []);

  return (
    <>
      <Connections
        createConnectionModal={createConnectionModal}
        onOpenCreateConnectionModal={handleCreateConnectionModalOpen}
        onCloseCreateConnectionModal={handleCreateConnectionModalClose}
        {...props}
      />
      {createConnectionModal.open && (
        <Modal
          open={true}
          schema={createConnection.rjsfSchema}
          uiSchema={createConnection.uiSchema}
          handleClose={handleCreateConnectionModalClose}
          handleSubmit={handleCreateConnectionSubmit}
          title="Connect Helm Repository"
          submitBtnText="Connect"
        />
      )}
    </>
  );
}
function Connections({ classes, updateProgress, /*onOpenCreateConnectionModal,*/ operatorState }) {
  const modalRef = useRef(null);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [pageSize, setPageSize] = useState(0);
  const [connections, setConnections] = useState([]);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [rowsExpanded, setRowsExpanded] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rowData, setSelectedRowData] = useState({});
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [_operatorState, _setOperatorState] = useState(operatorState || []);
  const [tab, setTab] = useState(0);
  const ping = useKubernetesHook();

  const open = Boolean(anchorEl);
  const _operatorStateRef = useRef(_operatorState);
  _operatorStateRef.current = _operatorState;
  const meshSyncResetRef = useRef(null);
  const { notify } = useNotification();
  const StyleClass = useStyles();
  const url = `https://docs.meshery.io/concepts/connections`;

  // const icons = {
  //   [CONNECTION_STATES.IGNORED]: () => <RemoveCircleIcon />,
  //   [CONNECTION_STATES.CONNECTED]: () => <CheckCircleIcon />,
  //   [CONNECTION_STATES.REGISTERED]: () => <AssignmentTurnedInIcon />,
  //   [CONNECTION_STATES.DISCOVERED]: () => <ExploreIcon />,
  //   [CONNECTION_STATES.DELETED]: () => <DeleteForeverIcon />,
  //   [CONNECTION_STATES.MAINTENANCE]: () => <ExploreIcon />,
  //   [CONNECTION_STATES.DISCONNECTED]: () => <ExploreIcon />,
  //   [CONNECTION_STATES.NOTFOUND]: () => <ExploreIcon />,
  // };

  const columns = [
    {
      name: 'id',
      label: 'ID',
      options: {
        display: false,
      },
    },
    {
      name: 'metadata.server_location',
      label: 'Server Location',
      options: {
        display: false,
      },
    },
    {
      name: 'metadata.server',
      label: 'Server Location',
      options: {
        display: false,
      },
    },
    {
      name: 'name',
      label: 'Name',
      options: {
        sort: true,
        sortThirdClickReset: true,
        customHeadRender: function CustomHead({ index, ...column }, sortColumn, columnMeta) {
          return (
            <SortableTableCell
              index={index}
              columnData={column}
              columnMeta={columnMeta}
              onSort={() => sortColumn(index)}
            />
          );
        },
        customBodyRender: (value, tableMeta) => {
          const server = tableMeta.rowData[2] || tableMeta.rowData[1];
          return (
            <ConnectionChip
              tooltip={'Server: ' + server}
              title={value}
              status={tableMeta.rowData[7]}
              onDelete={() => handleDeleteConnection(tableMeta.rowData[0])}
              handlePing={() => {
                if (tableMeta.rowData[4] === KUBERNETES) {
                  ping(tableMeta.rowData[3], tableMeta.rowData[2], tableMeta.rowData[0]);
                }
              }}
              iconSrc={'/static/img/kubernetes.svg'}
              style={{ maxWidth: '120px' }}
            />
          );
        },
      },
    },
    {
      name: 'kind',
      label: 'Kind',
      options: {
        sort: true,
        sortThirdClickReset: true,
        customHeadRender: function CustomHead({ index, ...column }, sortColumn, columnMeta) {
          return (
            <SortableTableCell
              index={index}
              columnData={column}
              columnMeta={columnMeta}
              onSort={() => sortColumn(index)}
            />
          );
        },
      },
    },
    {
      name: 'type',
      label: 'Category',
      options: {
        sort: true,
        sortThirdClickReset: true,
        customHeadRender: function CustomHead({ index, ...column }, sortColumn, columnMeta) {
          return (
            <SortableTableCell
              index={index}
              columnData={column}
              columnMeta={columnMeta}
              onSort={() => sortColumn(index)}
            />
          );
        },
      },
    },
    {
      name: 'sub_type',
      label: 'Sub Category',
      options: {
        sort: true,
        sortThirdClickReset: true,
        customHeadRender: function CustomHead({ index, ...column }, sortColumn, columnMeta) {
          return (
            <SortableTableCell
              index={index}
              columnData={column}
              columnMeta={columnMeta}
              onSort={() => sortColumn(index)}
            />
          );
        },
      },
    },
    {
      name: 'updated_at',
      label: 'Updated At',
      options: {
        sort: true,
        sortThirdClickReset: true,
        display: false,
        customHeadRender: function CustomHead({ index, ...column }, sortColumn, columnMeta) {
          return (
            <SortableTableCell
              index={index}
              columnData={column}
              columnMeta={columnMeta}
              onSort={() => sortColumn(index)}
            />
          );
        },
        customBodyRender: function CustomBody(value) {
          return (
            <Tooltip
              title={
                <Moment startOf="day" format="LLL">
                  {value}
                </Moment>
              }
              placement="top"
              arrow
              interactive
            >
              <Moment format="LL">{value}</Moment>
            </Tooltip>
          );
        },
      },
    },
    {
      name: 'created_at',
      label: 'Discovered At',
      options: {
        sort: true,
        sortThirdClickReset: true,
        customHeadRender: function CustomHead({ index, ...column }, sortColumn, columnMeta) {
          return (
            <SortableTableCell
              index={index}
              columnData={column}
              columnMeta={columnMeta}
              onSort={() => sortColumn(index)}
            />
          );
        },
        customBodyRender: function CustomBody(value) {
          return (
            <Tooltip
              title={
                <Moment startOf="day" format="LLL">
                  {value}
                </Moment>
              }
              placement="top"
              arrow
              interactive
            >
              <Moment format="LL">{value}</Moment>
            </Tooltip>
          );
        },
      },
    },
    {
      name: 'status',
      label: 'Status',
      options: {
        sort: true,
        sortThirdClickReset: true,
        customHeadRender: function CustomHead({ index, ...column }) {
          return (
            <TableCell key={index}>
              <Tooltip title="Click to know about connection and status" placement="top">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <b>{column.label}</b>
                  <InfoIcon
                    color={theme.palette.secondary.iconMain}
                    style={iconSmall}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(url, '_blank');
                    }}
                  />
                </div>
              </Tooltip>
            </TableCell>
          );
        },
        customBodyRender: function CustomBody(value, tableMeta) {
          const disabled = value === 'deleted' ? true : false;
          return (
            <>
              <FormControl className={classes.chipFormControl}>
                <Select
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  disabled={disabled}
                  value={value}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    handleStatusChange(e, tableMeta.rowData[0], tableMeta.rowData[4])
                  }
                  className={classes.statusSelect}
                  disableUnderline
                  MenuProps={{
                    anchorOrigin: {
                      vertical: 'bottom',
                      horizontal: 'left',
                    },
                    transformOrigin: {
                      vertical: 'top',
                      horizontal: 'left',
                    },
                    getContentAnchorEl: null,
                  }}
                >
                  {Object.keys(CONNECTION_STATES).map((s) => (
                    <MenuItem value={CONNECTION_STATES[s]} key={CONNECTION_STATES[s]}>
                      <ConnectionStateChip status={CONNECTION_STATES[s]} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          );
        },
      },
    },
    {
      name: 'Actions',
      options: {
        filter: false,
        sort: false,
        searchable: false,
        customHeadRender: function CustomHead({ ...column }) {
          return (
            <TableCell>
              <b>{column.label}</b>
            </TableCell>
          );
        },
        customBodyRender: function CustomBody(_, tableMeta) {
          return (
            <div className={classes.centerContent}>
              {tableMeta.rowData[4] === KUBERNETES ? (
                <IconButton
                  aria-label="more"
                  id="long-button"
                  aria-haspopup="true"
                  onClick={(e) => handleActionMenuOpen(e, tableMeta)}
                >
                  <MoreVertIcon style={iconMedium} />
                </IconButton>
              ) : (
                '-'
              )}
            </div>
          );
        },
      },
    },
  ];

  const options = useMemo(
    () => ({
      filter: false,
      viewColumns: false,
      search: false,
      responsive: 'standard',
      resizableColumns: true,
      serverSide: true,
      count,
      rowsPerPage: pageSize,
      rowsPerPageOptions: [10, 20, 30],
      fixedHeader: true,
      page,
      print: false,
      download: false,
      textLabels: {
        selectedRows: {
          text: 'connection(s) selected',
        },
      },
      customToolbarSelect: (selected) => (
        <Button
          variant="contained"
          color="primary"
          size="large"
          // @ts-ignore
          onClick={() => handleDeleteConnections(selected)}
          style={{ background: '#8F1F00', marginRight: '10px' }}
        >
          <DeleteForeverIcon style={iconMedium} />
          Delete
        </Button>
      ),
      enableNestedDataAccess: '.',
      onTableChange: (action, tableState) => {
        const sortInfo = tableState.announceText ? tableState.announceText.split(' : ') : [];
        let order = '';
        if (tableState.activeColumn) {
          order = `${columns[tableState.activeColumn].name} desc`;
        }
        switch (action) {
          case 'changePage':
            setPage(tableState.page.toString());
            break;
          case 'changeRowsPerPage':
            setPageSize(tableState.rowsPerPage.toString());
            break;
          case 'sort':
            if (sortInfo.length == 2) {
              if (sortInfo[1] === 'ascending') {
                order = `${columns[tableState.activeColumn].name} asc`;
              } else {
                order = `${columns[tableState.activeColumn].name} desc`;
              }
            }
            if (order !== sortOrder) {
              setSortOrder(order);
            }
            break;
        }
      },
      expandableRows: true,
      expandableRowsHeader: false,
      expandableRowsOnClick: true,
      rowsExpanded: rowsExpanded,
      isRowExpandable: () => {
        return true;
      },
      onRowExpansionChange: (_, allRowsExpanded) => {
        setRowsExpanded(allRowsExpanded.slice(-1).map((item) => item.index));
        setShowMore(false);
      },
      renderExpandableRow: (rowData, tableMeta) => {
        const colSpan = rowData.length;
        const connection = connections && connections[tableMeta.rowIndex];
        return (
          <TableCell colSpan={colSpan} className={classes.innerTableWrapper}>
            <TableContainer className={classes.innerTableContainer}>
              <Table>
                <TableRow className={classes.noGutter}>
                  <TableCell style={{ padding: '20px 0', overflowX: 'hidden' }}>
                    <Grid container spacing={1} style={{ textTransform: 'lowercase' }}>
                      <Grid item xs={12} md={12} className={classes.contentContainer}>
                        <Grid container spacing={1}>
                          <Grid item xs={12} md={12} className={classes.contentContainer}>
                            <FormatConnectionMetadata connection={connection} />
                          </Grid>
                        </Grid>
                      </Grid>
                    </Grid>
                  </TableCell>
                </TableRow>
              </Table>
            </TableContainer>
          </TableCell>
        );
      },
    }),
    [rowsExpanded, showMore, page, pageSize],
  );

  /**
   * fetch connections when the page loads
   */
  useEffect(() => {
    if (!loading) {
      getConnections(page, pageSize, search, sortOrder);
    }
  }, [page, pageSize, search, sortOrder]);

  const getConnections = (page, pageSize, search, sortOrder) => {
    setLoading(true);
    if (!search) search = '';
    if (!sortOrder) sortOrder = '';
    dataFetch(
      `/api/integrations/connections?page=${page}&pagesize=${pageSize}&search=${encodeURIComponent(
        search,
      )}&order=${encodeURIComponent(sortOrder)}`,
      {
        credentials: 'include',
        method: 'GET',
      },
      (res) => {
        setConnections(res?.connections || []);
        setPage(res?.page || 0);
        setCount(res?.total_count || 0);
        setPageSize(res?.page_size || 0);
        setLoading(false);
      },
      handleError(ACTION_TYPES.FETCH_CONNECTIONS),
    );
  };

  const handleError = (action) => (error) => {
    updateProgress({ showProgress: false });
    notify({
      message: `${action.error_msg}: ${error}`,
      event_type: EVENT_TYPES.ERROR,
      details: error.toString(),
    });
  };

  const handleStatusChange = (e, connectionId, connectionKind) => {
    e.stopPropagation();
    const requestBody = JSON.stringify({
      [connectionId]: e.target.value,
    });
    dataFetch(
      `/api/integrations/connections/${connectionKind}/status`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      },
      () => {
        getConnections(page, pageSize, search, sortOrder);
      },
      handleError(ACTION_TYPES.UPDATE_CONNECTION),
    );
  };

  const handleDeleteConnections = async (selected) => {
    if (selected) {
      let response = await modalRef.current.show({
        title: `Delete Connections`,
        subtitle: `Are you sure that you want to delete connections"?`,
        options: ['Delete', 'No'],
        variant: PROMPT_VARIANTS.DANGER,
      });
      if (response === 'Delete') {
        selected.data.map(({ index }) => {
          deleteConnection(connections[index].id);
        });
      }
    }
  };

  const handleDeleteConnection = async (id) => {
    if (id) {
      let response = await modalRef.current.show({
        title: `Delete Connection`,
        subtitle: `Are you sure that you want to delete connection"?`,
        options: ['Delete', 'No'],
        variant: PROMPT_VARIANTS.DANGER,
      });
      if (response === 'Delete') {
        deleteConnection(id);
      }
    }
  };

  const deleteConnection = (connectionId) => {
    dataFetch(
      `/api/integrations/connections/${connectionId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      },
      () => {
        getConnections(page, pageSize, search, sortOrder);
      },
      handleError(ACTION_TYPES.DELETE_CONNECTION),
    );
  };

  const handleActionMenuOpen = (event, tableMeta) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedRowData(tableMeta);
  };

  const handleActionMenuClose = () => {
    setAnchorEl(null);
  };

  const handleFlushMeshSync = (index) => {
    return async () => {
      handleActionMenuClose();
      let response = await meshSyncResetRef.current.show({
        title: `Flush MeshSync data for ${connections[index].metadata?.name} ?`,
        subtitle: `Are you sure to Flush MeshSync data for “${connections[index].metadata?.name}”? Fresh MeshSync data will be repopulated for this context, if MeshSync is actively running on this cluster.`,
        options: ['PROCEED', 'CANCEL'],
        variant: PROMPT_VARIANTS.WARNING,
      });
      if (response === 'PROCEED') {
        updateProgress({ showProgress: true });
        resetDatabase({
          selector: {
            clearDB: 'true',
            ReSync: 'true',
            hardReset: 'false',
          },
          k8scontextID: connections[index].metadata?.id,
        }).subscribe({
          next: (res) => {
            updateProgress({ showProgress: false });
            if (res.resetStatus === 'PROCESSING') {
              notify({ message: `Database reset successful.`, event_type: EVENT_TYPES.SUCCESS });
            }
          },
          error: handleError('Database is not reachable, try restarting server.'),
        });
      }
    };
  };

  function getOperatorStatus(index) {
    const ctxId = connections[index]?.metadata?.id;
    const operator = _operatorState?.find((op) => op.contextID === ctxId);
    if (!operator) {
      return {};
    }
    const operatorStatus = operator.operatorStatus;
    return {
      operatorState: operatorStatus.status === ENABLED,
      operatorVersion: operatorStatus.version,
    };
  }

  const handleOperatorSwitch = (index, checked) => {
    const contextId = connections[index].metadata?.id;
    const variables = {
      status: `${checked ? ENABLED : DISABLED}`,
      contextID: contextId,
    };

    updateProgress({ showProgress: true });

    changeOperatorState((response, errors) => {
      updateProgress({ showProgress: false });

      if (errors !== undefined) {
        handleError(`Unable to ${!checked ? 'Uni' : 'I'}nstall operator`);
      }
      notify({
        message: `Operator ${response.operatorStatus.toLowerCase()}`,
        event_type: EVENT_TYPES.SUCCESS,
      });

      const tempSubscription = fetchMesheryOperatorStatus({ k8scontextID: contextId }).subscribe({
        next: (res) => {
          _setOperatorState(updateCtxInfo(contextId, res));
          tempSubscription.unsubscribe();
        },
        error: (err) => console.log('error at operator scan: ' + err),
      });
    }, variables);
  };

  const updateCtxInfo = (ctxId, newInfo) => {
    if (newInfo.operator.error) {
      handleError('There is problem With operator')(newInfo.operator.error.description);
      return;
    }

    const state = _operatorStateRef.current;
    const op = state?.find((ctx) => ctx.contextID === ctxId);
    if (!op) {
      return [...state, { contextID: ctxId, operatorStatus: newInfo.operator }];
    }

    let ctx = { ...op };
    const removeCtx = state?.filter((ctx) => ctx.contextID !== ctxId);
    ctx.operatorStatus = newInfo.operator;
    return removeCtx ? [...removeCtx, ctx] : [ctx];
  };

  const [tableCols, updateCols] = useState(columns);

  const [columnVisibility, setColumnVisibility] = useState(() => {
    // Initialize column visibility based on the original columns' visibility
    const initialVisibility = {};
    columns.forEach((col) => {
      initialVisibility[col.name] = col.options?.display !== false;
    });
    return initialVisibility;
  });

  return (
    <>
      <NoSsr>
        <AppBar position="static" color="default" className={classes.appBar}>
          <Tabs
            value={tab}
            className={classes.tabs}
            onChange={(e, newTab) => {
              e.stopPropagation();
              setTab(newTab);
            }}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
            sx={{
              height: '10%',
            }}
          >
            <Tab
              className={classes.tab}
              label={
                <div className={classes.iconText}>
                  <span style={{ marginRight: '0.3rem' }}>Connections</span>
                  <ConnectionIcon width="20" height="20" />
                  {/* <img src="/static/img/connection-light.svg" className={classes.icon} /> */}
                </div>
              }
            />
            <Tab
              className={classes.tab}
              label={
                <div className={classes.iconText}>
                  <span style={{ marginRight: '0.3rem' }}>MeshSync</span>
                  <MeshsyncIcon width="20" height="20" />
                </div>
              }
            />
          </Tabs>
        </AppBar>
        {tab === 0 && (
          <div
            className={StyleClass.toolWrapper}
            style={{ marginBottom: '5px', marginTop: '-30px' }}
          >
            <div className={classes.createButton}>
              {/* <div>
              <Button
                aria-label="Rediscover"
                variant="contained"
                color="primary"
                size="large"
                // @ts-ignore
                onClick={onOpenCreateConnectionModal}
                style={{ marginRight: '1rem', borderRadius: '5px' }}
              >
                Connect Helm Repository
              </Button>
            </div> */}
              <MesherySettingsEnvButtons />
            </div>
            <div
              className={classes.searchAndView}
              style={{
                display: 'flex',
                borderRadius: '0.5rem 0.5rem 0 0',
              }}
            >
              <SearchBar
                onSearch={(value) => {
                  setSearch(value);
                }}
                placeholder="Search connections..."
              />

              <CustomColumnVisibilityControl
                columns={columns}
                customToolsProps={{ columnVisibility, setColumnVisibility }}
              />
            </div>
          </div>
        )}
        {tab === 0 && (
          <ResponsiveDataTable
            data={connections}
            columns={columns}
            options={options}
            className={classes.muiRow}
            tableCols={tableCols}
            updateCols={updateCols}
            columnVisibility={columnVisibility}
          />
        )}
        {tab === 1 && (
          <MeshSyncTable classes={classes} updateProgress={updateProgress} search={search} />
        )}
        <PromptComponent ref={modalRef} />
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleActionMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <Grid style={{ margin: '10px' }}>
            <div className={classNames(classes.list, classes.listButton)}>
              <Box className={classes.listItem} sx={{ width: '100%' }}>
                <Button
                  type="submit"
                  onClick={handleFlushMeshSync(rowData.rowIndex)}
                  data-cy="btnResetDatabase"
                  className={classes.button}
                >
                  <SyncIcon {...iconMedium} fill={theme.palette.secondary.iconMain} />
                  <Typography variant="body1" style={{ marginLeft: '0.5rem' }}>
                    Flush MeshSync
                  </Typography>
                </Button>
              </Box>
            </div>
            <div className={classes.list}>
              <Box className={classes.listItem} sx={{ width: '100%' }}>
                <div className={classes.listContainer}>
                  <Switch
                    defaultChecked={getOperatorStatus(rowData.rowIndex)?.operatorState}
                    onClick={(e) => handleOperatorSwitch(rowData.rowIndex, e.target.checked)}
                    name="OperatorSwitch"
                    color="primary"
                    className={classes.OperatorSwitch}
                  />
                  <Typography variant="body1">Operator</Typography>
                </div>
              </Box>
            </div>
          </Grid>
        </Popover>
        <PromptComponent ref={meshSyncResetRef} />
      </NoSsr>
    </>
  );
}

const SortableTableCell = ({ index, columnData, columnMeta, onSort }) => {
  return (
    <TableCell key={index} onClick={onSort}>
      <TableSortLabel
        active={columnMeta.name === columnData.name}
        direction={columnMeta.direction || 'asc'}
      >
        <b>{columnData.label}</b>
      </TableSortLabel>
    </TableCell>
  );
};

const mapDispatchToProps = (dispatch) => ({
  updateProgress: bindActionCreators(updateProgress, dispatch),
});

const mapStateToProps = (state) => {
  const k8sconfig = state.get('k8sConfig');
  const selectedK8sContexts = state.get('selectedK8sContexts');
  const operatorState = state.get('operatorState');
  return { k8sconfig, selectedK8sContexts, operatorState };
};

// @ts-ignore
export default withStyles(styles)(
  connect(mapStateToProps, mapDispatchToProps)(ConnectionManagementPage),
);
