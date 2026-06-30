"""
企智 · WorkflowParser
工作流 YAML/JSON → 结构化对象
"""

import yaml
from typing import Any, Dict, List, Optional


class WorkflowNode:
    def __init__(self, id: str, type: str, config: Dict[str, Any]):
        self.id = id
        self.type = type
        self.config = config

    def __repr__(self):
        return f"<WorkflowNode {self.id}[{self.type}]>"


class WorkflowEdge:
    def __init__(self, source: str, target: str, label: str = ""):
        self.source = source
        self.target = target
        self.label = label


class Workflow:
    def __init__(self, name: str, nodes: List[WorkflowNode], edges: List[WorkflowEdge]):
        self.name = name
        self.nodes = nodes
        self.edges = edges

    def __repr__(self):
        return f"<Workflow '{self.name}' nodes={len(self.nodes)} edges={len(self.edges)}>"


class WorkflowParser:
    """解析 YAML/JSON 工作流定义"""

    def parse(self, yaml_str: str) -> Workflow:
        data = yaml.safe_load(yaml_str)
        if not data:
            raise ValueError("Empty workflow definition")

        wf_data = data.get("workflow", data)
        name = wf_data.get("name", "Untitled")

        # 解析节点
        nodes = []
        for node_data in wf_data.get("nodes", []):
            node = WorkflowNode(
                id=node_data.get("id", "node"),
                type=node_data.get("type", "action"),
                config=node_data.get("config", {}),
            )
            nodes.append(node)

        # 解析边
        edges = []
        for edge_data in wf_data.get("edges", []):
            edge = WorkflowEdge(
                source=edge_data.get("source", ""),
                target=edge_data.get("target", ""),
                label=edge_data.get("label", ""),
            )
            edges.append(edge)

        return Workflow(name=name, nodes=nodes, edges=edges)
