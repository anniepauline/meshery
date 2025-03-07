package kubernetes

import (
	"context"
	"fmt"

	"github.com/gofrs/uuid"
	"github.com/layer5io/meshery/server/machines"
	"github.com/layer5io/meshery/server/models"
	"github.com/layer5io/meshkit/models/events"
)


type DiscoverAction struct {}

// Execute On Entry and Exit should not return next eventtype i suppose, look again.
func(da *DiscoverAction) ExecuteOnEntry(ctx context.Context, machineCtx interface{}) (machines.EventType, *events.Event, error) {
	return machines.NoOp, nil, nil
}

func(da *DiscoverAction) Execute(ctx context.Context, machineCtx interface{}) (machines.EventType, *events.Event, error) {
	user, _ := ctx.Value(models.UserCtxKey).(*models.User)
	sysID, _ := ctx.Value(models.SystemIDKey).(*uuid.UUID)
	userUUID := uuid.FromStringOrNil(user.ID)

	eventBuilder := events.NewEvent().ActedUpon(userUUID).WithCategory("connection").WithAction("update").FromSystem(*sysID).FromUser(userUUID).WithDescription("Failed to interact with the connection.").WithSeverity(events.Error)  

	machinectx, err := GetMachineCtx(machineCtx, eventBuilder)
	if err != nil {
		eventBuilder.WithMetadata(map[string]interface{}{"error": err})
		return machines.NoOp, eventBuilder.Build(), err
	}

	k8sContext := machinectx.K8sContext
	handler := machinectx.clientset

	err = k8sContext.AssignServerID(handler)
	// perofmr event publishinh and err handling
	if err != nil {
		return machines.NotFound, eventBuilder.WithDescription(fmt.Sprintf("Could not assign server id, skipping context %s", k8sContext.Name)).WithMetadata(map[string]interface{}{
				"error": err,
			}).Build(), err
	}

	err = k8sContext.AssignVersion(handler)
	// perofmr event publishinh and err handling
	if err != nil {
		machinectx.log.Info("unable to set kubernes server version, continuing without assigning version")
	}
	token, _ := ctx.Value(models.TokenCtxKey).(string)

	// peform error handling and event publishing
	connection, err := machinectx.Provider.SaveK8sContext(token, machinectx.K8sContext)
	if err != nil {
		return machines.NoOp, eventBuilder.WithDescription(fmt.Sprintf("Unable to establish connection with context \"%s\" at %s", k8sContext.Name, k8sContext.Server)).WithMetadata(map[string]interface{}{"error": err}).Build(), err
	}
	
	machinectx.log.Debug("exiting execute func from discovered state", connection)

	return machines.Register, nil, nil
}

func(da *DiscoverAction) ExecuteOnExit(ctx context.Context, machineCtx interface{}) (machines.EventType, *events.Event, error) {
	return machines.NoOp, nil, nil
}
