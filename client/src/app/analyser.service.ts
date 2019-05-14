import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from '../environments/environment';
import { tap, map, catchError } from 'rxjs/operators';

import { ANode } from "./analyser/node";
import { AGroup } from "./analyser/group";

import { GraphService } from './graph.service';
import { Principle } from './model/principles';
import { Smell } from './model/smell';
import { SmellObject, GroupSmellObject, SingleLayerTeamSmellObject } from './analyser/smell';

import { IgnoreOnceRefactoring, MergeServicesRefactoring, AddMessageRouterRefactoring, AddMessageBrokerRefactoring, AddServiceDiscoveryRefactoring, UseTimeoutRefactoring, AddCircuitBreakerRefactoring, SplitDatabaseRefactoring, AddDataManagerRefactoring, Refactoring, IgnoreAlwaysRefactoring, AddApiGatewayRefactoring, MoveDatabaseIntoTeamRefactoring, MoveserviceIntoTeamRefactoring, AddDataManagerIntoTeamRefactoring } from "./refactor/refactoring";
import { AddMessageRouterCommand, AddMessageBrokerCommand, AddCircuitBreakerCommand, AddServiceDiscoveryCommand, UseTimeoutCommand, MergeServicesCommand, SplitDatabaseCommand, AddDataManagerCommand, IgnoreOnceCommand, IgnoreAlwaysCommand, AddApiGatewayCommand, MoveDatabaseIntoTeamCommand, MoveServiceIntoTeamCommand, AddDataManagerIntoTeamCommand } from "./refactor/refactoring-command";
import { WobblyServiceInteractionSmellObject, SharedPersistencySmellObject, EndpointBasedServiceInteractionSmellObject, NoApiGatewaySmellObject } from "./analyser/smell";
import { CommunicationPattern } from "./model/communicationpattern";


const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

@Injectable({
  providedIn: 'root'
})

export class AnalyserService {


  private analysisUrl = environment.serverUrl + '/api/analyse';

  analysednodes: ANode[] = [];   // list of analysed node;
  analysedgroups: AGroup[] = []; // list of analysed groups;

  constructor(private http: HttpClient, private gs: GraphService) { }

  // Remove the "smells" icons in the nodes and groups
  clearSmells() {
    this.gs.getGraph().getNodes().forEach(node => {
      node.resetSmells();
    });
    this.gs.getGraph().getGroups().forEach(group => {
      group.resetSmells();
    });
  }

  getCommunicationPatterns() {
    return this.http.get<any>('assets/data/communicationpatterns.json')
      .toPromise()
      .then(res => <CommunicationPattern[]>res.data);
  }

  getPrinciplesToAnalyse() {
    return this.http.get<any>('assets/data/principles.json')
      .toPromise()
      .then(res => (<Principle[]>res.data).filter(principle => principle.id != 1))
  }

  getPrinciplesAndSmells() {
    return this.http.get<any>('assets/data/principles.json')
      .toPromise()
      .then(res => <Principle[]>res.data);
  }

  getSmells() {
    return this.http.get<any>('assets/data/smells.json')
      .toPromise()
      .then(res => <Smell[]>res.data);
  }

  getSmellById(id: number) {
    return this.http.get<any>('assets/data/smells.json')
      .toPromise()
      .then(res => (<Smell[]>res.data).find(smell => smell.id == id))//smell.id === id))
  }


  runRemoteAnalysis(smells: Smell[]): Observable<Boolean> {
    let smells_ids: number[] = smells.map(smell => smell.id);
    /*
      {
        smell: {
            name: "WobblyServicINTeractions"
            id: 1
        }
      }
    */

    const params = new HttpParams().set('smells', smells_ids.join());

    // let nodeIgnoreAlwaysSmells:string[];
    // this.gs.getGraph().getNodes().forEach(node=>{
    //   // console.log(node.getName());
    //   // console.log(node.getIgnoreAlwaysSmells());
    //   // nodeIgnoreAlwaysSmells.push(`${node.getName()}::`)
    //   //   node.getIgnoreAlwaysSmells().forEach(smell=>{

    //   //   })
    // })

    // return this.http.post(this.analysisUrl, { params })
    //   .subscribe((data) =>{
    //     console.log(response);
    //   });
    // TODO: the analysis should send ignore always command to the analyser.

    // Maybe instead of a get is s POST operation.
    return this.http.get(this.analysisUrl, { params })
      .pipe(
        map((response: Response) => {
          this.analysednodes = [];
          // TODO: saved the analysed node ?? in order to have the history of the analysis.
          this.clearSmells(); // removed the smell in the graph view
          response['nodes'].forEach((node) => {
            var anode = this.buildAnalysedNodeFromJson(node);
            this.analysednodes.push(anode);
          });
          this.analysedgroups = [];
          response['groups'].forEach((group) => {
            let agroup = this.buildAnalysedGroupFromJson(group);
            console.log(agroup);
            this.analysedgroups.push(agroup);
          });
          return true;
        }),
        tap(_ => this.log(`Send analysis`),
        ),
        catchError((e: Response) => throwError(e))
      );
  }

  buildAnalysedGroupFromJson(data: Object) {
    var agroup: AGroup = new AGroup(data['name']);
    let group = this.gs.getGraph().getGroup(data['name']);
    data['smells'].forEach((smellJson) => {
      let smell: GroupSmellObject;
      switch (smellJson.name) {
        case "NoApiGateway":
          smell = new NoApiGatewaySmellObject(group);
          break;
        case "SingleLayerTeam":
          smell = new SingleLayerTeamSmellObject(group)
          break;
        default:
          break;
      }
      smellJson['nodes'].forEach((node_name) => {
        let node = this.gs.getGraph().findNodeByName(node_name);
        smell.addNodeBasedCuase(node);
        smell.addRefactoring(new IgnoreOnceRefactoring(new IgnoreOnceCommand(node, smell)));
        smell.addRefactoring(new IgnoreAlwaysRefactoring(new IgnoreAlwaysCommand(node, smell)));
      });
      smellJson['links'].forEach((causa_link) => {
        var source = this.gs.getGraph().findNodeByName(causa_link['source']);
        var target = this.gs.getGraph().findNodeByName(causa_link['target']);
        var link = this.gs.getGraph().getLinkFromSourceToTarget(source, target);
        smell.addLinkBasedCause(link);
      });
      smellJson['refactorings'].forEach((refactoringJson) => {
        let refactoringName = refactoringJson['name'];
        let refactoring: Refactoring;
        switch (refactoringName) {
          case "Add Api Gateway":
            refactoring = new AddApiGatewayRefactoring(new AddApiGatewayCommand(this.gs.getGraph(), smell));
            break;
          case "Move Database":
            refactoring = new MoveDatabaseIntoTeamRefactoring (new MoveDatabaseIntoTeamCommand(this.gs.getGraph(), smell))
            break;
          case "Move Service":
            refactoring = new MoveserviceIntoTeamRefactoring( new MoveServiceIntoTeamCommand(this.gs.getGraph(), smell))
            break;
          case "Add Data Manager Team":
          console.log("ADD DAA AMGNER");
            refactoring = new AddDataManagerIntoTeamRefactoring( new AddDataManagerIntoTeamCommand(this.gs.getGraph(), smell));
            break;
          default:
            break;
        }
        if (refactoring)
          smell.addRefactoring(refactoring);
      });
      agroup.addSmell(smell);
    });
    return agroup;
  }

  buildAnalysedNodeFromJson(data: Object) {
    var anode: ANode = new ANode(data['name']);

    data['smells'].forEach((smellJson) => {
      let smell: SmellObject;

      switch (smellJson.name) {
        case "EndpointBasedServiceInteractionSmell":
          smell = new EndpointBasedServiceInteractionSmellObject();
          break;
        case "WobblyServiceInteractionSmell":
          smell = new WobblyServiceInteractionSmellObject();
          break;
        case "SharedPersistencySmell":
          smell = new SharedPersistencySmellObject();
          break;
        default:
          break;
      }

      smellJson['links'].forEach((cause) => {
        var source = this.gs.getGraph().findNodeByName(cause['source']);
        var target = this.gs.getGraph().findNodeByName(cause['target']);
        var link = this.gs.getGraph().getLinkFromSourceToTarget(source, target);
        smell.addLinkBasedCause(link);
        smell.addNodeBasedCuase(this.gs.getGraph().findNodeByName(anode.name))
      });

      let node = this.gs.getGraph().findRootByName(anode.name);
      smell.addRefactoring(new IgnoreOnceRefactoring(new IgnoreOnceCommand(node, smell)));
      smell.addRefactoring(new IgnoreAlwaysRefactoring(new IgnoreAlwaysCommand(node, smell)));

      smellJson['refactorings'].forEach((refactoringJson) => {
        let refactoringName = refactoringJson['name'];
        let refactoring: Refactoring;

        switch (refactoringName) {
          case "Add Message Router":
            refactoring = new AddMessageRouterRefactoring(new AddMessageRouterCommand(this.gs.getGraph(), smell));
            break;
          case "Add Message Broker":
            refactoring = new AddMessageBrokerRefactoring(new AddMessageBrokerCommand(this.gs.getGraph(), smell));
            break;
          case "Add Service Discovery":
            refactoring = new AddServiceDiscoveryRefactoring(new AddServiceDiscoveryCommand(this.gs.getGraph(), smell));
            break;
          case "Add Circuit Breaker":
            refactoring = new AddCircuitBreakerRefactoring(new AddCircuitBreakerCommand(this.gs.getGraph(), smell));
            break;
          case "Use Timeouts":
            refactoring = new UseTimeoutRefactoring(new UseTimeoutCommand(this.gs.getGraph(), smell));
            break;
          case "Merge services":
            refactoring = new MergeServicesRefactoring(new MergeServicesCommand(this.gs.getGraph(), smell));
            break;
          case "Split Database":
            refactoring = new SplitDatabaseRefactoring(new SplitDatabaseCommand(this.gs.getGraph(), smell));
            break;
          case "Add Data Manager":
            refactoring = new AddDataManagerRefactoring(new AddDataManagerCommand(this.gs.getGraph(), smell));
          default:
            break;
        }
        if (refactoring)
          smell.addRefactoring(refactoring);
      });
      anode.addSmell(smell);
    });
    return anode;
  }

  getAnalysedNodeByName(name: string) {
    return this.analysednodes.find(node => {
      return name === node.name;
    });
  }

  /** Log a AnalyserService message with the MessageService */
  private log(message: string) {
    // this.add(`HeroService: ${message}`);
  }
}
